import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";

import { authenticateRequest } from "./auth.js";
import { config } from "./config.js";
import { enforceActiveSubscription } from "./subscription.js";
import { activityRouter } from "./routes/activity.js";
import { configRouter } from "./routes/config.js";
import { familyAccessRouter, familyPortalRouter } from "./routes/familyPortal.js";
import { healthRouter } from "./routes/health.js";
import { patientRouter } from "./routes/patients.js";
import { organisationsRouter } from "./routes/organisations.js";
import { staffRouter } from "./routes/staff.js";
import { staffPortalRouter } from "./routes/staffPortal.js";
import { billingRouter, stripeWebhookHandler } from "./routes/billing.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(express.json({ limit: "1mb" }));
app.use(authenticateRequest);
app.use(enforceActiveSubscription);

app.use("/health", healthRouter);
app.use("/api/staff", staffRouter);
app.use("/api/billing", billingRouter);
app.use("/api/organisations", organisationsRouter);
app.use("/api/staff-portal", staffPortalRouter);
app.use("/api/family-access", familyAccessRouter);
app.use("/api/family-portal", familyPortalRouter);
app.use("/api/patients", patientRouter);
app.use("/api/config", configRouter);
app.use("/api", activityRouter);

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`SecureObs backend listening on port ${config.port}`);
});
