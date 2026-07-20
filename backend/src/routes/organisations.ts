import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { recordAuditEvent } from "../audit.js";
import { requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { pool } from "../db/pool.js";

const router = Router();
const createOrganisationSchema = z.object({ name: z.string().trim().min(2).max(255) });

router.get("/", requireStaffRole(["super_admin"]), async (_request, response, next) => {
  try {
    const result = await pool.query(
      `select organisations.id, organisations.name,
              coalesce(settings.subscription_plan, 'hospital') as "subscriptionPlan",
              coalesce(settings.service_status, 'active') as "serviceStatus",
              settings.site_limit_override as "siteLimitOverride",
              settings.wards_per_site_limit_override as "wardsPerSiteLimitOverride",
              count(distinct sites.id)::integer as "siteCount",
              count(distinct wards.id)::integer as "wardCount"
       from organisations
       left join organisation_settings settings on settings.organisation_id = organisations.id
       left join sites on sites.organisation_id = organisations.id
       left join wards on wards.site_id = sites.id
       group by organisations.id, organisations.name, settings.subscription_plan, settings.service_status,
                settings.site_limit_override, settings.wards_per_site_limit_override
       order by organisations.name`,
    );
    response.json({ organisations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireStaffRole(["super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const parsed = createOrganisationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Customer organisation name is required" });
      return;
    }
    const id = crypto.randomUUID();
    await pool.query("insert into organisations (id, name) values ($1, $2)", [id, parsed.data.name]);
    await pool.query(
      `insert into organisation_settings (
         organisation_id, nfc_staff_code_format, subscription_plan, feature_overrides,
         service_status, suspension_message
       ) values ($1, 'passcode={STAFFCODE}', 'essential', '{}'::jsonb, 'active', '')`,
      [id]
    );
    const actor = request.auth?.staff;
    await recordAuditEvent({
      organisationId: actor?.organisationId ?? id,
      actorStaffId: actor?.id,
      actorStaffCode: actor?.staffCode,
      eventType: "organisation.create",
      entityType: "organisation",
      entityId: id,
      details: { name: parsed.data.name }
    });
    response.status(201).json({ organisation: { id, name: parsed.data.name, subscriptionPlan: "essential", serviceStatus: "active", siteCount: 0, wardCount: 0 } });
  } catch (error) {
    next(error);
  }
});

export { router as organisationsRouter };
