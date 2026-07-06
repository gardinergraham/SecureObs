import "dotenv/config";

const defaultPort = 3000;
const defaultSessionTtlMinutes = 12 * 60;
const configuredSessionTtlMinutes = Number(
  process.env.SESSION_TTL_MINUTES ?? defaultSessionTtlMinutes
);
const sessionTtlMinutes =
  Number.isFinite(configuredSessionTtlMinutes) && configuredSessionTtlMinutes > 0
    ? configuredSessionTtlMinutes
    : defaultSessionTtlMinutes;

export const config = {
  port: Number(process.env.PORT ?? defaultPort),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  dataProvider: process.env.DATA_PROVIDER ?? "postgres",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "secureobs-development-session-secret",
  sessionTtlMinutes
};

if (!config.databaseUrl) {
  console.warn("DATABASE_URL is not set. Database routes will fail until it is configured.");
}
if (sessionTtlMinutes !== configuredSessionTtlMinutes) {
  console.warn(
    `SESSION_TTL_MINUTES must be a positive number. Falling back to ${defaultSessionTtlMinutes}.`
  );
}
