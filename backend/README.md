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
