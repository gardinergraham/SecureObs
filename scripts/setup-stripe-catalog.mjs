// Dry run by default. --apply creates/reuses the catalogue in test mode.
// Live mode requires both --apply and --live; never prints API credentials.
import { createRequire } from 'node:module';
import { catalogue } from '../backend/src/billing/package-pricing.js';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const Stripe = require('stripe');
const entries = [];
for (const [key, plan] of Object.entries(catalogue.plans)) for (const interval of ['monthly','yearly']) entries.push({key, label:plan.label, interval, amount:plan[interval], tax:'exclusive', env:`STRIPE_PRICE_${key.toUpperCase()}_${interval.toUpperCase()}`});
const names = { medication:'MEDICATION',rostering:'ROSTERING',securityChecks:'SECURITY',dashboard:'ANALYTICS',cqcReporting:'GOVERNANCE' };
for (const module of catalogue.modules) entries.push({key:module.id,label:module.label,interval:'monthly',amount:catalogue.moduleMonthly,tax:'exclusive',env:`STRIPE_PRICE_${names[module.id]}_MONTHLY`});
entries.push({key:'tablets',label:'Tablet hire',interval:'monthly',amount:catalogue.tabletMonthlyIncludingVat,tax:'inclusive',env:'STRIPE_PRICE_TABLET_HIRE_MONTHLY'});
for (const entry of entries) console.log(`${entry.label}: GBP ${(entry.amount/100).toFixed(2)} ${entry.interval}, VAT ${entry.tax} → ${entry.env}`);
if (!process.argv.includes('--apply')) {
  console.log('Dry run only. No Stripe changes. Use --apply with a test key to create test products/prices. Configure Stripe Tax registrations before checkout.');
  process.exit(0);
}
const key = process.env.STRIPE_SECRET_KEY;
const live = process.argv.includes('--live');
if (!key || !(live ? key.startsWith('sk_live_') : key.startsWith('sk_test_'))) throw new Error(`Set a ${live?'live':'test'} Stripe secret key for this mode.`);
const stripe = new Stripe(key);
const products = new Map();
for (const entry of entries) {
  const lookupKey=`secureobs_${entry.key}_${entry.interval}_${entry.amount}_${entry.tax}_v1`;
  const existing = (await stripe.prices.list({lookup_keys:[lookupKey],limit:1})).data[0];
  if (existing) {
    if (!existing.active || existing.unit_amount !== entry.amount || existing.currency !== 'gbp' || existing.tax_behavior !== entry.tax || existing.recurring?.interval !== (entry.interval==='monthly'?'month':'year')) throw new Error(`Existing price for ${entry.label} does not match. Review it in Stripe.`);
    products.set(entry.key,typeof existing.product==='string'?existing.product:existing.product.id);
    console.log(`${entry.env}=${existing.id}`); continue;
  }
  let product=products.get(entry.key);
  if(!product) {
    const created=await stripe.products.create({name:`SecureObs ${entry.label}`,metadata:{secureobs_key:entry.key}}, {idempotencyKey:`secureobs-product-${entry.key}-v1`});
    product=created.id;products.set(entry.key,product);
  }
  const price=await stripe.prices.create({product,currency:'gbp',unit_amount:entry.amount,tax_behavior:entry.tax,
    recurring:{interval:entry.interval==='monthly'?'month':'year'},lookup_key:lookupKey}, {idempotencyKey:lookupKey});
  console.log(`${entry.env}=${price.id}`);
}
console.log('Catalogue ready. Save the printed price IDs in the backend environment for this Stripe mode.');
