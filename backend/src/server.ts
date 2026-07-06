import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";

import { authenticateRequest } from "./auth.js";
import { config } from "./config.js";
import { activityRouter } from "./routes/activity.js";
import { configRouter } from "./routes/config.js";
import { familyAccessRouter, familyPortalRouter } from "./routes/familyPortal.js";
import { healthRouter } from "./routes/health.js";
import { patientRouter } from "./routes/patients.js";
import { staffRouter } from "./routes/staff.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(authenticateRequest);

app.use("/health", healthRouter);
app.use("/api/staff", staffRouter);
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
