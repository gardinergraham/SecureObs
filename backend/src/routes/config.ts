import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";

const router = Router();
const fallbackOrganisationId = "00000000-0000-0000-0000-000000000001";

const siteSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: z.string().uuid().optional().default(fallbackOrganisationId),
  name: z.string().min(1)
});

const wardSchema = z.object({
  id: z.string().min(1).optional(),
  siteId: z.string().min(1),
  name: z.string().min(1),
  serviceType: z.string().min(1),
  observationIntervalMinutes: z.number().int().positive().default(15),
  news2Enabled: z.boolean().default(true),
  enhancedObservationsEnabled: z.boolean().default(true),
  securityChecksEnabled: z.boolean().default(true),
  medicationChartEnabled: z.boolean().default(true),
  staffRotaEnabled: z.boolean().default(true)
});

router.get("/sites", async (_request, response, next) => {
  try {
    const result = await pool.query("select id, name from sites order by name asc");
    response.json({ sites: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/sites", async (request, response, next) => {
  try {
    const parsed = siteSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid site", details: parsed.error.flatten() });
      return;
    }

    const site = {
      ...parsed.data,
      id: parsed.data.id ?? createId("site", parsed.data.name)
    };

    const result = await pool.query(
      `
        insert into sites (id, organisation_id, name)
        values ($1, $2, $3)
        on conflict (id) do update set name = excluded.name
        returning id, name
      `,
      [site.id, site.organisationId, site.name]
    );

    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/wards", async (_request, response, next) => {
  try {
    const result = await pool.query(`
      select
        id,
        site_id as "siteId",
        name,
        service_type as "serviceType",
        observation_interval_minutes as "observationIntervalMinutes",
        news2_enabled as "news2Enabled",
        enhanced_observations_enabled as "enhancedObservationsEnabled",
        security_checks_enabled as "securityChecksEnabled",
        medication_chart_enabled as "medicationChartEnabled",
        staff_rota_enabled as "staffRotaEnabled"
      from wards
      order by name asc
    `);

    response.json({ wards: result.rows.map(toAppWard) });
  } catch (error) {
    next(error);
  }
});

router.post("/wards", async (request, response, next) => {
  try {
    const parsed = wardSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid ward", details: parsed.error.flatten() });
      return;
    }

    const ward = {
      ...parsed.data,
      id: parsed.data.id ?? createId("ward", parsed.data.name)
    };

    const result = await pool.query(
      `
        insert into wards (
          id, site_id, name, service_type, observation_interval_minutes, news2_enabled,
          enhanced_observations_enabled, security_checks_enabled, medication_chart_enabled, staff_rota_enabled
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (id) do update set
          site_id = excluded.site_id,
          name = excluded.name,
          service_type = excluded.service_type,
          observation_interval_minutes = excluded.observation_interval_minutes,
          news2_enabled = excluded.news2_enabled,
          enhanced_observations_enabled = excluded.enhanced_observations_enabled,
          security_checks_enabled = excluded.security_checks_enabled,
          medication_chart_enabled = excluded.medication_chart_enabled,
          staff_rota_enabled = excluded.staff_rota_enabled
        returning
          id,
          site_id as "siteId",
          name,
          service_type as "serviceType",
          observation_interval_minutes as "observationIntervalMinutes",
          news2_enabled as "news2Enabled",
          enhanced_observations_enabled as "enhancedObservationsEnabled",
          security_checks_enabled as "securityChecksEnabled",
          medication_chart_enabled as "medicationChartEnabled",
          staff_rota_enabled as "staffRotaEnabled"
      `,
      [
        ward.id,
        ward.siteId,
        ward.name,
        ward.serviceType,
        ward.observationIntervalMinutes,
        ward.news2Enabled,
        ward.enhancedObservationsEnabled,
        ward.securityChecksEnabled,
        ward.medicationChartEnabled,
        ward.staffRotaEnabled
      ]
    );

    response.status(201).json(toAppWard(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

function createId(prefix: string, name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 36);

  return `${prefix}-${slug || Date.now()}`;
}

function toAppWard(row: Record<string, unknown>) {
  const id = String(row.id);

  return {
    ...row,
    rotaShiftCount: 3,
    rotaShifts: [
      { id: `${id}-shift-1`, startsAt: "07:00", endsAt: "15:00" },
      { id: `${id}-shift-2`, startsAt: "15:00", endsAt: "23:00" },
      { id: `${id}-shift-3`, startsAt: "23:00", endsAt: "07:00" }
    ],
    breakDurationMinutes: 30,
    selected: false
  };
}

export { router as configRouter };
