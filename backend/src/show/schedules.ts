import type Stripe from 'stripe';
import { addCalendarMonths } from './offer.js';

type ScheduleInput = { orderId: string; billingAccountId: string; customer: string; paymentMethod: string;
  date: string; softwareItems: {price: string; quantity: number}[]; tabletPrice?: string; tablets: number };
export function scheduleParameters(input: ScheduleInput, kind: 'software' | 'tablets'): Stripe.SubscriptionScheduleCreateParams {
  const metadata: Record<string, string> = kind === 'software' ? { showOrderId: input.orderId, billingAccountId: input.billingAccountId, kind }
    : { showOrderId: input.orderId, kind };
  return { customer: input.customer, start_date: addCalendarMonths(input.date, 0), end_behavior: 'release',
    billing_mode: { type: 'flexible' }, metadata,
    default_settings: { default_payment_method: input.paymentMethod, collection_method: 'charge_automatically', automatic_tax: { enabled: false } },
    phases: [{ items: kind === 'software' ? input.softwareItems : [{price: input.tabletPrice!, quantity: input.tablets}],
      end_date: addCalendarMonths(input.date, 12),
      ...(kind === 'tablets' ? {trial_end: addCalendarMonths(input.date, 6)} : {}),
      metadata, proration_behavior: 'none', discounts: '', default_tax_rates: [] }]
  };
}
// Recover an externally created schedule after a process crash, even after Stripe's
// idempotency retention window. Each show order has its own Stripe customer.
export async function ensureSchedule(stripe: Stripe, params: Stripe.SubscriptionScheduleCreateParams, key: string) {
  const existing = await stripe.subscriptionSchedules.list({ customer: params.customer, limit: 100 });
  const metadata = params.metadata as Record<string, string>;
  const match = existing.data.find(s => s.metadata?.showOrderId === metadata.showOrderId && s.metadata?.kind === metadata.kind);
  if (match) return match;
  if (typeof params.start_date !== 'number' || params.start_date <= Date.now()/1000 + 300) throw new Error('The activation date has passed or is too close. Contact SecureObs before scheduling.');
  if (existing.has_more) throw new Error('Schedule reconciliation needs administrator review.');
  return stripe.subscriptionSchedules.create(params, { idempotencyKey: key });
}
