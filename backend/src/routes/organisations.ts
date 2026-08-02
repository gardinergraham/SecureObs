import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { recordAuditEvent } from "../audit.js";
import { requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { pool } from "../db/pool.js";

const router = Router();
const createOrganisationSchema = z.object({ name: z.string().trim().min(2).max(255) });
const organisationIdSchema = z.string().uuid();

router.get("/", requireStaffRole(["super_admin"]), async (_request, response, next) => {
  try {
    const result = await pool.query(
      `select organisations.id, organisations.name,
              coalesce(settings.subscription_plan, 'hospital') as "subscriptionPlan",
              coalesce(settings.service_status, 'active') as "serviceStatus",
              settings.site_limit_override as "siteLimitOverride",
              settings.wards_per_site_limit_override as "wardsPerSiteLimitOverride",
              coalesce(billing.billing_status, 'not_configured') as "billingStatus",
              billing.billing_interval as "billingInterval",
              billing.current_period_end as "currentPeriodEnd",
              billing.grace_period_ends_at as "gracePeriodEndsAt",
              billing.billing_contact_name as "billingContactName",
              billing.billing_email as "billingEmail",
              billing.billing_phone as "billingPhone",
              billing.billing_city as "billingCity",
              billing.billing_postcode as "billingPostcode",
              billing.billing_country as "billingCountry",
              count(distinct sites.id)::integer as "siteCount",
              count(distinct wards.id)::integer as "wardCount"
       from organisations
       left join organisation_settings settings on settings.organisation_id = organisations.id
       left join billing_accounts billing on billing.organisation_id = organisations.id
       left join sites on sites.organisation_id = organisations.id
       left join wards on wards.site_id = sites.id
       group by organisations.id, organisations.name, settings.subscription_plan, settings.service_status,
                settings.site_limit_override, settings.wards_per_site_limit_override
                , billing.billing_status, billing.billing_interval, billing.current_period_end, billing.grace_period_ends_at,
                billing.billing_contact_name, billing.billing_email, billing.billing_phone,
                billing.billing_city, billing.billing_postcode, billing.billing_country
       order by organisations.name`,
    );
    response.json({ organisations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireStaffRole(["super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const parsed = createOrganisationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Customer organisation name is required" });
      return;
    }
    const id = crypto.randomUUID();
    await pool.query("insert into organisations (id, name) values ($1, $2)", [id, parsed.data.name]);
    await pool.query(
      `insert into organisation_settings (
         organisation_id, nfc_staff_code_format, subscription_plan, feature_overrides,
         service_status, suspension_message
       ) values ($1, 'passcode={STAFFCODE}', 'essential', '{}'::jsonb, 'active', '')`,
      [id]
    );
    const actor = request.auth?.staff;
    await recordAuditEvent({
      organisationId: actor?.organisationId ?? id,
      actorStaffId: actor?.id,
      actorStaffCode: actor?.staffCode,
      eventType: "organisation.create",
      entityType: "organisation",
      entityId: id,
      details: { name: parsed.data.name }
    });
    response.status(201).json({ organisation: { id, name: parsed.data.name, subscriptionPlan: "essential", serviceStatus: "active", siteCount: 0, wardCount: 0 } });
  } catch (error) {
    next(error);
  }
});

router.delete("/:organisationId", requireStaffRole(["super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  const parsedId = organisationIdSchema.safeParse(request.params.organisationId);
  if (!parsedId.success) {
    response.status(400).json({ error: "A valid customer organisation is required" });
    return;
  }

  const organisationId = parsedId.data;
  const actor = request.auth?.staff;
  if (actor?.organisationId === organisationId) {
    response.status(403).json({ error: "You cannot delete the organisation containing your super-admin account" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const organisation = await client.query("select name from organisations where id = $1 for update", [organisationId]);
    if (!organisation.rows[0]) {
      await client.query("rollback");
      response.status(404).json({ error: "Customer organisation not found" });
      return;
    }

    const usage = await client.query(
      `select
         (select count(*) from sites where organisation_id = $1)::integer as sites,
         (select count(*) from staff_members where organisation_id = $1)::integer as staff,
         (select count(*) from patients where organisation_id = $1)::integer as patients`,
      [organisationId]
    );
    const counts = usage.rows[0];
    if (counts.sites > 0 || counts.staff > 0 || counts.patients > 0) {
      await client.query("rollback");
      response.status(409).json({
        error: `This customer cannot be deleted because it contains ${counts.sites} site(s), ${counts.staff} staff member(s), or ${counts.patients} patient(s).`
      });
      return;
    }

    await client.query("delete from organisation_settings where organisation_id = $1", [organisationId]);
    await client.query("delete from organisations where id = $1", [organisationId]);
    await client.query("commit");

    await recordAuditEvent({
      organisationId: actor?.organisationId ?? organisationId,
      actorStaffId: actor?.id,
      actorStaffCode: actor?.staffCode,
      eventType: "organisation.delete",
      entityType: "organisation",
      entityId: organisationId,
      details: { name: organisation.rows[0].name, emptyCustomer: true }
    }).catch((auditError) => console.error("Unable to record organisation deletion audit event", auditError));
    response.json({ ok: true });
  } catch (error) {
    await client.query("rollback");
    if (typeof error === "object" && error && "code" in error && error.code === "23503") {
      response.status(409).json({ error: "This customer contains linked SecureObs records and cannot be deleted" });
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

export { router as organisationsRouter };
