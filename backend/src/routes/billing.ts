import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { z } from "zod";

import { requireAuthenticated, requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";

const router = Router();
const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

const checkoutSchema = z.object({
  organisationName: z.string().trim().min(2).max(255),
  contactName: z.string().trim().min(2).max(255),
  billingEmail: z.string().trim().email().max(320),
  billingPhone: z.string().trim().max(50).optional().default(""),
  plan: z.enum(["essential", "professional", "enterprise"]),
  interval: z.enum(["monthly", "yearly"]),
  wardQuantity: z.number().int().min(1).max(100).default(1),
  acceptedTerms: z.literal(true)
});

function requireStripe(response: Response) {
  if (!stripe) {
    response.status(503).json({ error: "Online payments are not configured yet. Please contact SecureObs." });
    return null;
  }
  return stripe;
}

router.post("/checkout", async (request, response, next) => {
  try {
    const client = requireStripe(response);
    if (!client) return;
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Please complete all required subscription details", details: parsed.error.flatten() });
      return;
    }
    const { plan, interval } = parsed.data;
    const priceId = config.stripePriceIds[plan][interval];
    if (!priceId) {
      response.status(503).json({ error: `The ${plan} ${interval} Stripe price has not been configured` });
      return;
    }
    const quantity = plan === "enterprise" ? 1 : parsed.data.wardQuantity;
    const billingAccountId = crypto.randomUUID();
    const customer = await client.customers.create({
      name: parsed.data.organisationName,
      email: parsed.data.billingEmail,
      phone: parsed.data.billingPhone || undefined,
      metadata: { billingAccountId, organisationName: parsed.data.organisationName }
    });
    await pool.query(
      `insert into billing_accounts (
         id, organisation_name, billing_contact_name, billing_email, billing_phone,
         stripe_customer_id, stripe_price_id, subscription_plan, billing_interval, licensed_ward_quantity
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [billingAccountId, parsed.data.organisationName, parsed.data.contactName, parsed.data.billingEmail,
       parsed.data.billingPhone || null, customer.id, priceId, plan, interval, quantity]
    );
    const metadata = { billingAccountId, plan, billingInterval: interval, licensedWardQuantity: String(quantity) };
    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity }],
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      metadata,
      subscription_data: { metadata },
      success_url: `${config.publicWebsiteUrl}/billing-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.publicWebsiteUrl}/subscribe.html?cancelled=1`
    });
    response.status(201).json({ checkoutUrl: session.url });
  } catch (error) {
    next(error);
  }
});

router.post("/portal", requireStaffRole(["manager", "super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const client = requireStripe(response);
    if (!client) return;
    const auth = requireAuthenticated(request, response);
    if (!auth) return;
    const requestedOrganisationId = typeof request.body?.organisationId === "string" ? request.body.organisationId : undefined;
    const organisationId = auth.staff.role === "super_admin" && requestedOrganisationId
      ? requestedOrganisationId
      : auth.staff.organisationId;
    const result = await pool.query(
      `select stripe_customer_id as "stripeCustomerId" from billing_accounts where organisation_id = $1`,
      [organisationId]
    );
    const customerId = result.rows[0]?.stripeCustomerId;
    if (!customerId) {
      response.status(404).json({ error: "No Stripe billing account is linked to this organisation" });
      return;
    }
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: config.publicWebsiteUrl
    });
    response.json({ portalUrl: session.url });
  } catch (error) {
    next(error);
  }
});

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const timestamps = subscription.items.data.map((item) => item.current_period_end).filter(Boolean);
  return timestamps.length ? new Date(Math.max(...timestamps) * 1000) : null;
}

async function ensureOrganisationForBillingAccount(billingAccountId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const accountResult = await client.query(`select * from billing_accounts where id = $1 for update`, [billingAccountId]);
    const account = accountResult.rows[0];
    if (!account || account.organisation_id) {
      await client.query("commit");
      return account?.organisation_id as string | undefined;
    }
    const organisationId = crypto.randomUUID();
    await client.query(`insert into organisations (id, name) values ($1, $2)`, [organisationId, account.organisation_name]);
    await client.query(
      `insert into organisation_settings (
         organisation_id, nfc_staff_code_format, subscription_plan, feature_overrides, service_status, suspension_message
       ) values ($1, 'passcode={STAFFCODE}', $2, '{}'::jsonb, 'active', '')`,
      [organisationId, account.subscription_plan]
    );
    await client.query(`update billing_accounts set organisation_id = $2, updated_at = now() where id = $1`, [billingAccountId, organisationId]);
    await client.query("commit");
    return organisationId;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function syncSubscription(subscription: Stripe.Subscription, invoiceId?: string | null) {
  const billingAccountId = subscription.metadata.billingAccountId;
  if (!billingAccountId) return;
  const status = (["incomplete", "trialing", "active", "past_due", "unpaid", "canceled"] as const)
    .includes(subscription.status as never) ? subscription.status : "incomplete";
  await pool.query(
    `update billing_accounts set
       stripe_subscription_id=$2, stripe_price_id=$3, billing_status=$4,
       current_period_end=$5, cancel_at_period_end=$6, last_invoice_id=coalesce($7,last_invoice_id), updated_at=now()
     where id=$1`,
    [billingAccountId, subscription.id, subscription.items.data[0]?.price.id ?? null, status,
     subscriptionPeriodEnd(subscription), subscription.cancel_at_period_end, invoiceId ?? null]
  );
}

export async function stripeWebhookHandler(request: Request, response: Response) {
  if (!stripe || !config.stripeWebhookSecret) {
    response.status(503).send("Stripe webhook is not configured");
    return;
  }
  const signature = request.headers["stripe-signature"];
  if (!signature) {
    response.status(400).send("Missing Stripe signature");
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(request.body, signature, config.stripeWebhookSecret);
  } catch (error) {
    response.status(400).send(`Webhook signature verification failed: ${error instanceof Error ? error.message : "invalid payload"}`);
    return;
  }
  const inserted = await pool.query(
    `insert into stripe_webhook_events (event_id,event_type) values ($1,$2) on conflict do nothing returning event_id`,
    [event.id, event.type]
  );
  if (!inserted.rowCount) {
    response.json({ received: true });
    return;
  }
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const billingAccountId = session.metadata?.billingAccountId;
      if (billingAccountId && typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription);
        if (subscription.status === "active" || subscription.status === "trialing") await ensureOrganisationForBillingAccount(billingAccountId);
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription : null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(subscription, invoice.id);
        const id = subscription.metadata.billingAccountId;
        if (id) {
          await pool.query(`update billing_accounts set billing_status='active', last_payment_at=now(), payment_failed_at=null, grace_period_ends_at=null, updated_at=now() where id=$1`, [id]);
          await ensureOrganisationForBillingAccount(id);
        }
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription : null;
      if (subscriptionId) {
        await pool.query(
          `update billing_accounts set billing_status='past_due', payment_failed_at=coalesce(payment_failed_at,now()),
             grace_period_ends_at=coalesce(grace_period_ends_at, now() + ($2::text || ' days')::interval),
             last_invoice_id=$3, updated_at=now() where stripe_subscription_id=$1`,
          [subscriptionId, config.billingGraceDays, invoice.id]
        );
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object);
    }
    response.json({ received: true });
  } catch (error) {
    await pool.query(`delete from stripe_webhook_events where event_id=$1`, [event.id]).catch(() => undefined);
    console.error("Stripe webhook processing failed", error);
    response.status(500).send("Webhook processing failed");
  }
}

export { router as billingRouter };
