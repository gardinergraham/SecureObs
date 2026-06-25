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
