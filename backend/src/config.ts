import "dotenv/config";

const defaultPort = 3000;

export const config = {
  port: Number(process.env.PORT ?? defaultPort),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  dataProvider: process.env.DATA_PROVIDER ?? "postgres",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "secureobs-development-session-secret",
  sessionTtlMinutes: Number(process.env.SESSION_TTL_MINUTES ?? 12 * 60)
};

if (!config.databaseUrl) {
  console.warn("DATABASE_URL is not set. Database routes will fail until it is configured.");
}
