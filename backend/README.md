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
- `PORT` is supplied by Railway automatically

The mobile app should call this API. It should not connect directly to Postgres.

## First endpoints

- `GET /health`
- `GET /api/staff`
- `GET /api/staff/by-code/:staffCode`
- `POST /api/staff/lookup`
