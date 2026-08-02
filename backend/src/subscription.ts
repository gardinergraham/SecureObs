import type { NextFunction, Response } from "express";

import type { AuthenticatedRequest } from "./auth.js";
import { pool } from "./db/pool.js";

export async function enforceActiveSubscription(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const staff = request.auth?.staff;
  if (!staff || staff.role === "super_admin" || request.path === "/api/config/organisation-settings" || request.path === "/api/billing/portal" || request.path === "/api/billing/sync-customer") {
    next();
    return;
  }

  try {
    const result = await pool.query(
      `select settings.service_status as "serviceStatus", settings.suspension_message as "suspensionMessage",
              billing.billing_status as "billingStatus", billing.grace_period_ends_at as "gracePeriodEndsAt"
       from organisation_settings settings
       left join billing_accounts billing on billing.organisation_id = settings.organisation_id
       where settings.organisation_id = $1`,
      [staff.organisationId]
    );
    const settings = result.rows[0];
    if (settings?.serviceStatus === "suspended") {
      response.status(423).json({
        error: settings.suspensionMessage || "SecureObs access is temporarily suspended. Please contact your account administrator."
      });
      return;
    }
    const billingBlocked = settings && ["unpaid", "canceled"].includes(settings.billingStatus)
      || settings?.billingStatus === "past_due"
        && settings.gracePeriodEndsAt
        && new Date(settings.gracePeriodEndsAt).getTime() <= Date.now();
    if (billingBlocked) {
      response.status(423).json({
        error: "SecureObs access is temporarily paused because the subscription payment is overdue. Please ask your manager to update the billing details."
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
