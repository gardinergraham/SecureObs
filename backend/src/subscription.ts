import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "./auth.js";
import { pool } from "./db/pool.js";

export async function enforceActiveSubscription(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const staff = request.auth?.staff;
  if (!staff || staff.role === "super_admin" || request.path === "/api/config/organisation-settings") {
    next();
    return;
  }

  try {
    const result = await pool.query(
      `select service_status as "serviceStatus", suspension_message as "suspensionMessage"
       from organisation_settings where organisation_id = $1`,
      [staff.organisationId]
    );
    const settings = result.rows[0];
    if (settings?.serviceStatus === "suspended") {
      response.status(423).json({
        error: settings.suspensionMessage || "SecureObs access is temporarily suspended. Please contact your account administrator."
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
