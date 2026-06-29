import { Router } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { requireStaffRole } from "../auth.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();

const siteSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  name: z.string().min(1)
});

const organisationSettingsSchema = z.object({
  organisationId: optionalOrganisationIdSchema,
  nfcStaffCodeFormat: z.string().min(1)
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
  assessmentFormsEnabled: z.boolean().default(false),
  foodFluidChartEnabled: z.boolean().default(false),
  landingPage: z.enum(["overview", "observations"]).default("overview"),
  sessionTimeoutMinutes: z.number().int().positive().default(15),
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

const securityAreaSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  wardId: z.string().min(1),
  name: z.string().min(1),
  frequencyMinutes: z.number().int().positive(),
  requiresCount: z.boolean().default(false),
  category: z.enum(["cutlery", "ward_security", "level_1_patient_search", "level_1_room_locker_zone", "custom"]).default("custom"),
  frequencyType: z.enum(["per_shift", "per_meal", "daily", "weekly", "weekly_ad_hoc", "monthly"]).default("per_shift"),
  expectedItems: z.record(z.unknown()).default({}),
  active: z.boolean().default(true),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

router.get("/organisation-settings", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          organisation_id as "organisationId",
          nfc_staff_code_format as "nfcStaffCodeFormat"
        from organisation_settings
        where organisation_id = $1
      `,
      [organisationId]
    );

    response.json({
      settings: result.rows[0] ?? {
        organisationId,
        nfcStaffCodeFormat: "passcode={STAFFCODE}"
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post("/organisation-settings", requireStaffRole(["super_admin"]), async (request, response, next) => {
  try {
    const parsed = organisationSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid organisation settings", details: parsed.error.flatten() });
      return;
    }
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;

    const result = await pool.query(
      `
        insert into organisation_settings (organisation_id, nfc_staff_code_format)
        values ($1, $2)
        on conflict (organisation_id) do update set
          nfc_staff_code_format = excluded.nfc_staff_code_format,
          updated_at = now()
        returning
          organisation_id as "organisationId",
          nfc_staff_code_format as "nfcStaffCodeFormat"
      `,
      [organisationId, parsed.data.nfcStaffCodeFormat]
    );

    await recordAuditEvent({
      organisationId,
      ...auditActorFromBody(request.body),
      eventType: "settings.organisation.update",
      entityType: "organisation_settings",
      entityId: organisationId,
      details: { nfcStaffCodeFormat: parsed.data.nfcStaffCodeFormat }
    });
    response.status(201).json({ settings: result.rows[0] });
  } catch (error) {
    next(error);
  }
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

router.post("/sites", requireStaffRole(["super_admin"]), async (request, response, next) => {
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
        wards.assessment_forms_enabled as "assessmentFormsEnabled",
        wards.food_fluid_chart_enabled as "foodFluidChartEnabled",
        wards.landing_page as "landingPage",
        wards.session_timeout_minutes as "sessionTimeoutMinutes",
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

router.post("/wards", requireStaffRole(["manager", "super_admin"]), async (request, response, next) => {
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
          assessment_forms_enabled, food_fluid_chart_enabled, landing_page, session_timeout_minutes,
          rota_shift_count, rota_shifts, break_duration_minutes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)
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
          assessment_forms_enabled = excluded.assessment_forms_enabled,
          food_fluid_chart_enabled = excluded.food_fluid_chart_enabled,
          landing_page = excluded.landing_page,
          session_timeout_minutes = excluded.session_timeout_minutes,
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
          assessment_forms_enabled as "assessmentFormsEnabled",
          food_fluid_chart_enabled as "foodFluidChartEnabled",
          landing_page as "landingPage",
          session_timeout_minutes as "sessionTimeoutMinutes",
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
        ward.assessmentFormsEnabled,
        ward.foodFluidChartEnabled,
        ward.landingPage,
        ward.sessionTimeoutMinutes,
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
        observationIntervalMinutes: ward.observationIntervalMinutes,
        foodFluidChartEnabled: ward.foodFluidChartEnabled,
        landingPage: ward.landingPage
      }
    });
    response.status(201).json(toAppWard(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.get("/security-areas", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const wardId = typeof request.query.wardId === "string" ? request.query.wardId : undefined;

    const params = wardId ? [organisationId, wardId] : [organisationId];
    const result = await pool.query(
      `
        select
          id,
          ward_id as "wardId",
          name,
          frequency_minutes as "frequencyMinutes",
          requires_count as "requiresCount",
          category,
          frequency_type as "frequencyType",
          expected_items as "expectedItems",
          active
        from security_areas
        where organisation_id = $1
          ${wardId ? "and ward_id = $2" : ""}
        order by name asc
      `,
      params
    );

    response.json({ securityAreas: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/security-areas", requireStaffRole(["manager", "super_admin"]), async (request, response, next) => {
  try {
    const parsed = securityAreaSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid security area", details: parsed.error.flatten() });
      return;
    }
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;

    const wardResult = await pool.query(
      `
        select wards.id
        from wards
        inner join sites on sites.id = wards.site_id
        where wards.id = $1 and sites.organisation_id = $2
      `,
      [parsed.data.wardId, organisationId]
    );
    if (!wardResult.rowCount) {
      response.status(404).json({ error: "Ward not found for organisation" });
      return;
    }

    const securityArea = {
      ...parsed.data,
      organisationId,
      id: parsed.data.id ?? createId("security-area", `${parsed.data.wardId}-${parsed.data.name}`)
    };

    const result = await pool.query(
      `
        insert into security_areas (
          id, organisation_id, ward_id, name, frequency_minutes, requires_count, category, frequency_type, expected_items, active
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
        on conflict (id) do update set
          ward_id = excluded.ward_id,
          name = excluded.name,
          frequency_minutes = excluded.frequency_minutes,
          requires_count = excluded.requires_count,
          category = excluded.category,
          frequency_type = excluded.frequency_type,
          expected_items = excluded.expected_items,
          active = excluded.active,
          updated_at = now()
        returning
          id,
          ward_id as "wardId",
          name,
          frequency_minutes as "frequencyMinutes",
          requires_count as "requiresCount",
          category,
          frequency_type as "frequencyType",
          expected_items as "expectedItems",
          active
      `,
      [
        securityArea.id,
        securityArea.organisationId,
        securityArea.wardId,
        securityArea.name,
        securityArea.frequencyMinutes,
        securityArea.requiresCount,
        securityArea.category,
        securityArea.frequencyType,
        JSON.stringify(securityArea.expectedItems ?? {}),
        securityArea.active
      ]
    );

    await recordAuditEvent({
      organisationId,
      ...auditActorFromBody(request.body),
      eventType: "settings.security_area.upsert",
      entityType: "security_area",
      entityId: securityArea.id,
      details: {
        wardId: securityArea.wardId,
        name: securityArea.name,
        category: securityArea.category,
        frequencyType: securityArea.frequencyType,
        expectedItems: securityArea.expectedItems,
        active: securityArea.active
      }
    });
    response.status(201).json({ securityArea: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/security-areas/:id",
  requireStaffRole(["manager", "super_admin"]),
  async (request, response, next) => {
    try {
      const organisationId = requireOrganisationId(request, response);
      if (!organisationId) return;
      const areaId = String(request.params.id);
      const result = await pool.query(
        `
          delete from security_areas
          where id = $1 and organisation_id = $2
          returning id, ward_id as "wardId", name
        `,
        [areaId, organisationId]
      );

      if (!result.rowCount) {
        response.status(404).json({ error: "Security check setup not found" });
        return;
      }

      await recordAuditEvent({
        organisationId,
        eventType: "settings.security_area.delete",
        entityType: "security_area",
        entityId: areaId,
        details: {
          wardId: result.rows[0].wardId,
          name: result.rows[0].name
        }
      });
      response.json({ deletedId: areaId });
    } catch (error) {
      next(error);
    }
  }
);

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
    sessionTimeoutMinutes: Number(row.sessionTimeoutMinutes ?? 15),
    rotaShiftCount: Number(row.rotaShiftCount ?? rotaShifts.length ?? 3),
    rotaShifts,
    breakDurationMinutes: Number(row.breakDurationMinutes ?? 30),
    assessmentFormsEnabled: Boolean(row.assessmentFormsEnabled ?? false),
    foodFluidChartEnabled: Boolean(row.foodFluidChartEnabled ?? false),
    landingPage: row.landingPage === "observations" ? "observations" : "overview",
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
