import { Router } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();

const siteSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
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
  staffRotaEnabled: z.boolean().default(true),
  rotaShiftCount: z.number().int().positive().default(3),
  rotaShifts: z
    .array(
      z.object({
        id: z.string().min(1),
        startsAt: z.string().min(1),
        endsAt: z.string().min(1)
      })
    )
    .default([]),
  breakDurationMinutes: z.number().int().positive().default(30)
});

router.get("/sites", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query("select id, name from sites where organisation_id = $1 order by name asc", [
      organisationId
    ]);
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
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;

    const site = {
      ...parsed.data,
      organisationId,
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

    await recordAuditEvent({
      organisationId,
      ...auditActorFromBody(request.body),
      eventType: "settings.site.upsert",
      entityType: "site",
      entityId: site.id,
      details: { name: site.name }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/wards", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
      select
        wards.id,
        wards.site_id as "siteId",
        wards.name,
        wards.service_type as "serviceType",
        wards.observation_interval_minutes as "observationIntervalMinutes",
        wards.news2_enabled as "news2Enabled",
        wards.enhanced_observations_enabled as "enhancedObservationsEnabled",
        wards.security_checks_enabled as "securityChecksEnabled",
        wards.medication_chart_enabled as "medicationChartEnabled",
        wards.staff_rota_enabled as "staffRotaEnabled",
        wards.rota_shift_count as "rotaShiftCount",
        wards.rota_shifts as "rotaShifts",
        wards.break_duration_minutes as "breakDurationMinutes"
      from wards
      inner join sites on sites.id = wards.site_id
      where sites.organisation_id = $1
      order by wards.name asc
    `,
      [organisationId]
    );

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
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;

    const ward = {
      ...parsed.data,
      id: parsed.data.id ?? createId("ward", parsed.data.name)
    };

    const siteResult = await pool.query("select id from sites where id = $1 and organisation_id = $2", [
      ward.siteId,
      organisationId
    ]);
    if (!siteResult.rowCount) {
      response.status(404).json({ error: "Site not found for organisation" });
      return;
    }

    const result = await pool.query(
      `
        insert into wards (
          id, site_id, name, service_type, observation_interval_minutes, news2_enabled,
          enhanced_observations_enabled, security_checks_enabled, medication_chart_enabled, staff_rota_enabled,
          rota_shift_count, rota_shifts, break_duration_minutes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
        on conflict (id) do update set
          site_id = excluded.site_id,
          name = excluded.name,
          service_type = excluded.service_type,
          observation_interval_minutes = excluded.observation_interval_minutes,
          news2_enabled = excluded.news2_enabled,
          enhanced_observations_enabled = excluded.enhanced_observations_enabled,
          security_checks_enabled = excluded.security_checks_enabled,
          medication_chart_enabled = excluded.medication_chart_enabled,
          staff_rota_enabled = excluded.staff_rota_enabled,
          rota_shift_count = excluded.rota_shift_count,
          rota_shifts = excluded.rota_shifts,
          break_duration_minutes = excluded.break_duration_minutes
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
          staff_rota_enabled as "staffRotaEnabled",
          rota_shift_count as "rotaShiftCount",
          rota_shifts as "rotaShifts",
          break_duration_minutes as "breakDurationMinutes"
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
        ward.staffRotaEnabled,
        ward.rotaShiftCount,
        JSON.stringify(ward.rotaShifts),
        ward.breakDurationMinutes
      ]
    );

    await recordAuditEvent({
      organisationId,
      ...auditActorFromBody(request.body),
      eventType: "settings.ward.upsert",
      entityType: "ward",
      entityId: ward.id,
      details: {
        name: ward.name,
        siteId: ward.siteId,
        observationIntervalMinutes: ward.observationIntervalMinutes
      }
    });
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
  const rotaShifts = Array.isArray(row.rotaShifts) ? row.rotaShifts : defaultRotaShifts(id);

  return {
    ...row,
    rotaShiftCount: Number(row.rotaShiftCount ?? rotaShifts.length ?? 3),
    rotaShifts,
    breakDurationMinutes: Number(row.breakDurationMinutes ?? 30),
    selected: false
  };
}

function defaultRotaShifts(wardId: string) {
  return [
    { id: `${wardId}-shift-1`, startsAt: "07:00", endsAt: "15:00" },
    { id: `${wardId}-shift-2`, startsAt: "15:00", endsAt: "23:00" },
    { id: `${wardId}-shift-3`, startsAt: "23:00", endsAt: "07:00" }
  ];
}

export { router as configRouter };
