import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";

import { config } from "./config.js";
import { staffRouter } from "./routes/staff.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "secureobs-backend" });
});

app.use("/api/staff", staffRouter);

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`SecureObs backend listening on port ${config.port}`);
});
