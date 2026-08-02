import "dotenv/config";

const defaultPort = 3000;
const defaultSessionTtlMinutes = 12 * 60;
const minimumSessionTtlMinutes = 12 * 60;
const configuredSessionTtlMinutes = Number(
  process.env.SESSION_TTL_MINUTES ?? defaultSessionTtlMinutes
);
const sessionTtlMinutes =
  Number.isFinite(configuredSessionTtlMinutes) && configuredSessionTtlMinutes >= minimumSessionTtlMinutes
    ? configuredSessionTtlMinutes
    : defaultSessionTtlMinutes;

export const config = {
  port: Number(process.env.PORT ?? defaultPort),
  databaseUrl: process.env.DATABASE_URL,
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  dataProvider: process.env.DATA_PROVIDER ?? "postgres",
  sessionSecret: process.env.SESSION_SECRET ?? process.env.DATABASE_URL ?? "secureobs-development-session-secret",
  sessionTtlMinutes,
  publicWebsiteUrl: (process.env.PUBLIC_WEBSITE_URL ?? "https://secure-obs.com").replace(/\/$/, ""),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePriceIds: {
    essential: {
      monthly: process.env.STRIPE_PRICE_ESSENTIAL_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ESSENTIAL_YEARLY
    },
    professional: {
      monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY
    }
  },
  billingGraceDays: Math.max(1, Number(process.env.BILLING_GRACE_DAYS ?? 7))
};

if (!config.databaseUrl) {
  console.warn("DATABASE_URL is not set. Database routes will fail until it is configured.");
}
if (sessionTtlMinutes !== configuredSessionTtlMinutes) {
  console.warn(
    `SESSION_TTL_MINUTES must be at least ${minimumSessionTtlMinutes}. Falling back to ${defaultSessionTtlMinutes}.`
  );
}
