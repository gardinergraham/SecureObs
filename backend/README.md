# SecureObs Backend

Railway should deploy this folder, not the Expo app root.

## Local setup

```sh
npm install
cp .env.example .env
npm run migrate
npm run dev
```

## Railway

Set the Railway service root directory to `backend`.

Required environment variables:

- `DATABASE_URL` from the Railway Postgres service
- `CORS_ORIGIN` set to the Expo/web client origin when needed
- `DATA_PROVIDER=postgres` for the current Railway Postgres backend
- `SESSION_SECRET` set to a long random value so staff sessions stay valid across deploys
- `SESSION_TTL_MINUTES=720` for 12-hour staff sessions, or another trust-approved timeout
- `PORT` is supplied by Railway automatically

### Stripe subscriptions

Create six recurring GBP prices in Stripe test mode and add their IDs to Railway:

- Essential monthly: £149 per ward; yearly: £1,490 per ward
- Professional monthly: £299 per ward; yearly: £2,990 per ward
- Enterprise monthly: £1,499 per organisation; yearly: £14,990 per organisation

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the six `STRIPE_PRICE_...` variables shown in `.env.example`,
`PUBLIC_WEBSITE_URL=https://secure-obs.com`, and optionally `BILLING_GRACE_DAYS=7`.

In Stripe Workbench, add a webhook endpoint at:

`https://adequate-energy-production.up.railway.app/api/billing/webhook`

Subscribe it to `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.updated`, and `customer.subscription.deleted`. Enable the Stripe Customer Portal,
customer emails, and Smart Retries in the Stripe Dashboard. The webhook—not the browser success page—is the
source of truth for creating organisations and changing billing access.

The mobile app should call this API. It should not connect directly to Postgres.

### Isolated demonstration environment

Deploy the same backend into a separate Railway environment with its own Postgres database. Set
`DEMO_MODE=true`, `DEMO_REGISTRATION_ENABLED=true`, `DEMO_TRIAL_DAYS=14`, and
`DEMO_RETENTION_DAYS=30`. Use a unique `SESSION_SECRET`, set `PUBLIC_WEBSITE_URL=https://secure-obs.com`,
and set `CORS_ORIGIN=https://secure-obs.com`. Do not copy production Stripe secrets into this environment;
billing routes are disabled whenever demo mode is active.

`POST /api/demo/register` creates an isolated fictional ward and a time-limited manager login. Access expires
automatically, and trial organisations are deleted after the retention period when a later registration runs.

## Staff Sessions

`POST /api/staff/lookup` and `POST /api/staff/bank-pin-login` return a signed staff session as well as the staff record.
The app stores that token locally and sends it as a bearer token on later API calls. `GET /api/staff/session` verifies
the stored token and returns the current active staff member.

## Data Provider Layer

Routes should call repositories through `src/data/provider.ts`.

Current provider:

- `postgres`

Planned provider:

- `sqlserver`

When SQL Server support is added, the tablet app should remain unchanged. Only backend environment variables and the data-provider implementation should change.

SQL Server table creation scripts are in `sqlserver-migrations/`. They are not run by the Railway Postgres service;
they are the migration source for the future `DATA_PROVIDER=sqlserver` adapter.

## First endpoints

- `GET /health`
- `GET /api/staff`
- `GET /api/staff/by-code/:staffCode`
- `POST /api/staff/lookup`

### Ward-specific staff roles

Migration `051_staff_ward_roles.sql` adds `staff_members.ward_roles` and copies each
existing staff role to their assigned wards. Apply migrations before running the
updated API; deploy the API before the updated app. The migration preserves the
roles currently stored, so any role already overwritten before this change (for
example Sally's manager role) must be corrected explicitly in ward staff setup.

Staff records now include `wardRoles`, a ward ID to role mapping. Ward staff setup
changes the selected ward's role while preserving the other assignments. Platform
admin remains an organisation-independent identity role. The API resolves a
resource's ward for authorisation; `X-Ward-Id` supplies context for actions such as
staff setup and PIN resets. Queued requests retain their original ward context.
Managers may change assignments only in wards they manage. Prescribing permission
is independent of the ward role and can be granted to nurses by a manager.
Existing doctor prescribing access is retained.

Run the isolated regression checks (no live database required):

```sh
node backend/tests/staff-organisation.cjs
node backend/tests/ward-permissions.cjs
```

### Package builder and Stripe catalogue

The existing subscription page is now a per-ward package builder. Prices live in
`src/billing/package-pricing.js`; run `node scripts/sync-package-pricing.cjs` from
the repository root after changing it, and commit the generated website copy.

- Essential: £149 per ward/month excluding VAT; Professional: £299.
- Enterprise: £1,499 per organisation/month excluding VAT.
- Medication/eMAR, rostering, security checks, analytics and CQC governance:
  £45 per module/ward/month excluding VAT. Professional and Enterprise include
  all five, so included modules never become extra line items.
- Tablet hire: £37.99 per tablet/month **including VAT**. Do not convert this to
  a rounded exclusive price, which would change the amount customers pay.
- The calculator estimates UK VAT at 20%. Stripe Automatic Tax determines tax
  using the billing address, with software prices `exclusive` and tablets
  `inclusive`. The next-invoice preview refreshes the billing ledger total.
- Annual plans and modules cost 10 monthly fees for 12 months of service. Each
  module is £450/ward/year excluding VAT. Annual tablet hire charges all 12
  months: £455.88/tablet including VAT. Annual orders are billed upfront.

Deployment order and account setup:

1. Run `node scripts/setup-stripe-catalog.mjs` for a read-only catalogue plan.
   With `STRIPE_SECRET_KEY` set to a **test** key, `--apply` creates/reuses test
   products and prices. Live creation requires `--apply --live` and a live key.
   The script prints only price IDs, never credentials. Review product tax
   categories and configure the applicable Stripe Tax registration and business
   address. Complete this before enabling public checkout.
2. Save the price IDs in the backend environment, including monthly and annual prices for the six optional
   products in `.env.example`. Base prices must also use explicit exclusive VAT.
   Checkout validates amounts, GBP currency, recurrence and VAT behaviour.
3. Apply `052_package_builder.sql`, deploy the API, then publish the website and
   app updates. Keep test/live prices and webhook secrets separate.
4. In Stripe test mode, complete a two-ward order with rostering on one ward and
   two tablets. The UK estimate is £487.58/month. Verify the paid webhook creates
   the named sites/wards and enables rostering only on the paid ward. Set up
   staff and review each ward's clinical settings before use.

Orders store their selection and exact Stripe item mapping. Legacy subscriptions
retain their organisation-level behaviour. The builder creates new subscriptions;
it is not an amendment page for existing customers. Keep Stripe Customer Portal
subscription-item editing disabled until an amendment flow can allocate changed
purchases to named wards. Direct Stripe changes to builder subscriptions are
flagged in the billing report: removed items lose associated features, while
extra items require review. Tablet quantity changes preserve software access.
Existing-customer migrations require linking their current wards and agreed
selection; do not send them through new checkout and create a second subscription.

Checks from the repository root:

```sh
npm --prefix backend run build
node backend/tests/package-pricing.mjs
node backend/tests/package-checkout.mjs
node scripts/test-ward-manager-assignment.cjs
```

These are isolated tests using mocked Stripe/database services. The migration
and real Stripe checkout still need verification in a test environment.

### Live catalogue configured 7 September 2026

The live SecureObs account `acct_1SMa0pFR8WuWxgGE` now contains all 18 required
prices. `billing/stripe-live-price-ids.env` records their IDs (no credentials).
Copy these values into the backend hosting environment; the file is not loaded
automatically. Base prices retain their original IDs, with explicit exclusive
tax behaviour. Module prices exclude VAT and tablet prices include VAT.
The setup script reuses these recorded live IDs to avoid duplicate products.
The dashboard prompted for tax registration; confirm the company's VAT status
before configuring tax collection. No customer subscriptions were created or
changed, and the backend environment has not yet been updated with these IDs.

### VAT collection disabled until registration

The company confirmed it is not yet VAT registered. The canonical catalogue
sets `vatRegistered: false`; checkout sends `automatic_tax.enabled: false` and
the website charges no VAT. Customer prices remain £149/£299/£1,499 for monthly
plans, £45/module/ward/month and £37.99/tablet/month. Annual software/modules
cost 10 months; tablets cost all 12. Example: two Essential wards, one rostering
module and two tablets cost £418.98/month or £4,341.76/year while unregistered.
This supersedes the earlier VAT-inclusive example totals above.

After registration, configure the actual Stripe Tax registration and effective
date, set `vatRegistered` to true, bump the catalogue version, sync the website
catalogue, update public VAT wording, and deploy both backend and website.
Review existing subscription tax settings separately; this checkout setting
applies to new subscriptions and does not change existing ones.
