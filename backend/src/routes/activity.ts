import { Router } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { requirePrescriber, requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();
const anyWardStaff = ["nurse", "hcf", "ot", "security", "manager", "doctor", "super_admin"] as const;

const observationSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  observerName: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1),
  location: z.string().min(1),
  presentation: z.string().min(1),
  comments: z.string().default(""),
  observedAt: z.string().datetime()
});

const securityCheckSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  areaId: z.string().min(1),
  checkName: z.string().min(1),
  checkedBy: z.string().min(1),
  checkedAt: z.string().datetime(),
  notes: z.string().default(""),
  countedTotal: z.number().int().nonnegative().optional(),
  resultDetails: z.record(z.unknown()).default({})
});

const news2ReadingSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  recordedAt: z.string().datetime(),
  recordedBy: z.string().min(1),
  respirationRate: z.number().int(),
  spo2: z.number().int(),
  spo2Scale: z.string().min(1),
  onOxygen: z.boolean(),
  systolicBp: z.number().int(),
  pulse: z.number().int(),
  consciousness: z.string().min(1),
  temperature: z.number(),
  totalScore: z.number().int()
});

const foodFluidEntrySchema = z
  .object({
    id: z.string().min(1).optional(),
    organisationId: optionalOrganisationIdSchema,
    patientId: z.string().min(1),
    recordedAt: z.string().datetime(),
    recordedBy: z.string().min(1),
    mealPeriod: z.enum(["Breakfast", "Mid-morning", "Lunch", "Mid-afternoon", "Evening meal", "Bedtime"]),
    entryType: z.enum(["Food", "Drink", "Supplement"]),
    itemDescription: z.string().min(1),
    portionOffered: z.string().min(1),
    intakeLevel: z.enum(["Refused", "Less than half", "Half", "More than half", "All"]),
    fluidOfferedMl: z.number().int().nonnegative().optional(),
    fluidTakenMl: z.number().int().nonnegative().optional(),
    assistanceNotes: z.string().default(""),
    comments: z.string().default("")
  })
  .superRefine((entry, context) => {
    if (entry.entryType === "Drink" && (entry.fluidOfferedMl === undefined || entry.fluidTakenMl === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Drink entries require offered and taken millilitres",
        path: ["fluidTakenMl"]
      });
    }
    if (
      entry.fluidOfferedMl !== undefined &&
      entry.fluidTakenMl !== undefined &&
      entry.fluidTakenMl > entry.fluidOfferedMl
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Fluid taken cannot exceed fluid offered",
        path: ["fluidTakenMl"]
      });
    }
  });

const medicationPrescriptionSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  drugName: z.string().min(1),
  dose: z.string().min(1),
  route: z.string().min(1),
  prescriptionType: z.enum(["regular", "prn", "depot", "rapid"]).default("regular"),
  prnIndication: z.string().optional(),
  depotIntervalDays: z.number().int().positive().optional(),
  administrationTimes: z.array(z.string()).default([]),
  startDate: z.string().datetime(),
  stopDate: z.string().datetime().optional(),
  additionalInstructions: z.string().default(""),
  prescribedBy: z.string().min(1),
  prescribedAt: z.string().datetime(),
  discontinuedBy: z.string().optional(),
  discontinuedAt: z.string().datetime().optional(),
  discontinueReason: z.string().optional()
});

const medicationAdministrationSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  prescriptionId: z.string().min(1),
  patientId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  status: z.string().min(1),
  omissionCode: z.string().optional(),
  recordedBy: z.string().min(1),
  recordedAt: z.string().datetime(),
  notes: z.string().default("")
});

const missedObservationSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  wardId: z.string().min(1),
  source: z.string().default("General observations"),
  dueAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  allocatedStaffId: z.string().optional(),
  allocatedStaffName: z.string().min(1),
  recordedByStaffId: z.string().optional(),
  recordedByName: z.string().min(1),
  reason: z.string().min(1),
  details: z.string().default(""),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

const patientNoteSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  wardId: z.string().min(1),
  body: z.string().trim().min(1).max(20_000),
  recordedByStaffId: z.string().min(1),
  recordedByName: z.string().min(1),
  recordedByStaffCode: z.string().min(1),
  recordedAt: z.string().datetime(),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

const patientCarePlanSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  wardId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  identifiedNeeds: z.string().trim().min(1).max(10_000),
  risksAndTriggers: z.string().trim().max(10_000).default(""),
  goals: z.string().trim().min(1).max(10_000),
  interventions: z.string().trim().min(1).max(20_000),
  patientViews: z.string().trim().max(10_000).default(""),
  reviewDate: z.string().trim().min(1).max(50),
  additionalNotes: z.string().trim().max(10_000).default(""),
  createdByStaffId: z.string().min(1),
  createdByName: z.string().min(1),
  createdByStaffCode: z.string().min(1),
  createdAt: z.string().datetime(),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

const rotaAssignmentSchema = z.object({
  id: z.string().min(1),
  organisationId: optionalOrganisationIdSchema,
  wardId: z.string().min(1),
  staffId: z.string().min(1),
  role: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  patientId: z.string().optional(),
  notes: z.string().default(""),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

const staffShiftAssignmentSchema = z.object({
  id: z.string().min(1),
  organisationId: optionalOrganisationIdSchema,
  wardId: z.string().min(1),
  shiftId: z.string().min(1),
  staffId: z.string().min(1),
  date: z.string().min(1),
  nurseInCharge: z.boolean().optional(),
  medicationNurse: z.boolean().optional(),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

router.get("/observations", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          observer_name as "observerName",
          source,
          type,
          location,
          presentation,
          comments,
          observed_at as "observedAt"
        from observations
        where organisation_id = $1
        order by observed_at desc
      `,
      [organisationId]
    );

    response.json({ observations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/observations", requireStaffRole([...anyWardStaff]), async (request, response, next) => {
  try {
    const parsed = observationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid observation", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const observation = { ...parsed.data, organisationId, id: parsed.data.id ?? `observation-${Date.now()}` };
    const result = await pool.query(
      `
        insert into observations (
          id, organisation_id, patient_id, observer_name, source, type, location, presentation, comments, observed_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (id) do update set
          comments = excluded.comments
        returning
          id,
          patient_id as "patientId",
          observer_name as "observerName",
          source,
          type,
          location,
          presentation,
          comments,
          observed_at as "observedAt"
      `,
      [
        observation.id,
        observation.organisationId,
        observation.patientId,
        observation.observerName,
        observation.source,
        observation.type,
        observation.location,
        observation.presentation,
        observation.comments,
        observation.observedAt
      ]
    );

    await recordAuditEvent({
      organisationId: observation.organisationId,
      ...auditActorFromBody(request.body),
      eventType: "observation.save",
      entityType: "observation",
      entityId: observation.id,
      details: { patientId: observation.patientId, source: observation.source }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/patient-notes", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const wardId = typeof request.query.wardId === "string" ? request.query.wardId : undefined;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          ward_id as "wardId",
          body,
          recorded_by_staff_id as "recordedByStaffId",
          recorded_by_name as "recordedByName",
          recorded_by_staff_code as "recordedByStaffCode",
          recorded_at as "recordedAt"
        from patient_notes
        where organisation_id = $1
          and ($2::text is null or ward_id = $2::text)
        order by recorded_at desc
        limit 1000
      `,
      [organisationId, wardId ?? null]
    );

    response.json({ patientNotes: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/patient-notes", requireStaffRole([...anyWardStaff]), async (request, response, next) => {
  try {
    const parsed = patientNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid patient note", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const authenticatedStaff = (request as AuthenticatedRequest).auth?.staff;
    if (!authenticatedStaff) {
      response.status(401).json({ error: "Authenticated staff session required" });
      return;
    }
    if (
      authenticatedStaff.role !== "super_admin" &&
      !authenticatedStaff.allowedWardIds.includes(parsed.data.wardId)
    ) {
      response.status(403).json({ error: "Staff session is not authorised for this ward" });
      return;
    }
    const note = {
      ...parsed.data,
      organisationId,
      id: parsed.data.id ?? `patient-note-${Date.now()}`,
      recordedByStaffId: authenticatedStaff.id ?? parsed.data.recordedByStaffId,
      recordedByName: authenticatedStaff.name,
      recordedByStaffCode: authenticatedStaff.staffCode
    };
    const patientResult = await pool.query(
      `
        select id
        from patients
        where id = $1
          and organisation_id = $2
          and ward_id = $3
      `,
      [note.patientId, note.organisationId, note.wardId]
    );
    if (!patientResult.rows[0]) {
      response.status(404).json({ error: "Patient not found for this ward" });
      return;
    }

    const result = await pool.query(
      `
        insert into patient_notes (
          id, organisation_id, patient_id, ward_id, body, recorded_by_staff_id,
          recorded_by_name, recorded_by_staff_code, recorded_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (id) do nothing
        returning
          id,
          patient_id as "patientId",
          ward_id as "wardId",
          body,
          recorded_by_staff_id as "recordedByStaffId",
          recorded_by_name as "recordedByName",
          recorded_by_staff_code as "recordedByStaffCode",
          recorded_at as "recordedAt"
      `,
      [
        note.id,
        note.organisationId,
        note.patientId,
        note.wardId,
        note.body,
        note.recordedByStaffId,
        note.recordedByName,
        note.recordedByStaffCode,
        note.recordedAt
      ]
    );

    if (!result.rows[0]) {
      response.status(409).json({ error: "Patient note already exists" });
      return;
    }

    await recordAuditEvent({
      organisationId,
      actorStaffId: authenticatedStaff.id,
      actorStaffCode: authenticatedStaff.staffCode,
      eventType: "patient_note.save",
      entityType: "patient_note",
      entityId: note.id,
      details: {
        patientId: note.patientId,
        wardId: note.wardId,
        characterCount: note.body.length
      }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/patient-care-plans", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const wardId = typeof request.query.wardId === "string" ? request.query.wardId : undefined;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          ward_id as "wardId",
          title,
          identified_needs as "identifiedNeeds",
          risks_and_triggers as "risksAndTriggers",
          goals,
          interventions,
          patient_views as "patientViews",
          review_date as "reviewDate",
          additional_notes as "additionalNotes",
          created_by_staff_id as "createdByStaffId",
          created_by_name as "createdByName",
          created_by_staff_code as "createdByStaffCode",
          created_at as "createdAt"
        from patient_care_plans
        where organisation_id = $1
          and ($2::text is null or ward_id = $2::text)
        order by created_at desc
        limit 500
      `,
      [organisationId, wardId ?? null]
    );

    response.json({ patientCarePlans: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/patient-care-plans",
  requireStaffRole(["nurse", "manager", "doctor", "super_admin"]),
  async (request, response, next) => {
    try {
      const parsed = patientCarePlanSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Invalid patient care plan", details: parsed.error.flatten() });
        return;
      }

      const organisationId = requireOrganisationId(request, response);
      if (!organisationId) return;
      const authenticatedStaff = (request as AuthenticatedRequest).auth?.staff;
      if (!authenticatedStaff) {
        response.status(401).json({ error: "Authenticated staff session required" });
        return;
      }
      if (!authenticatedStaff.allowedWardIds.includes(parsed.data.wardId)) {
        response.status(403).json({ error: "Staff session is not authorised for this ward" });
        return;
      }

      const plan = {
        ...parsed.data,
        organisationId,
        id: parsed.data.id ?? `patient-care-plan-${Date.now()}`,
        createdByStaffId: authenticatedStaff.id ?? parsed.data.createdByStaffId,
        createdByName: authenticatedStaff.name,
        createdByStaffCode: authenticatedStaff.staffCode
      };
      const patientResult = await pool.query(
        `
          select id
          from patients
          where id = $1
            and organisation_id = $2
            and ward_id = $3
        `,
        [plan.patientId, plan.organisationId, plan.wardId]
      );
      if (!patientResult.rows[0]) {
        response.status(404).json({ error: "Patient not found for this ward" });
        return;
      }

      const result = await pool.query(
        `
          insert into patient_care_plans (
            id, organisation_id, patient_id, ward_id, title, identified_needs, risks_and_triggers,
            goals, interventions, patient_views, review_date, additional_notes,
            created_by_staff_id, created_by_name, created_by_staff_code, created_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
          on conflict (id) do nothing
          returning
            id,
            patient_id as "patientId",
            ward_id as "wardId",
            title,
            identified_needs as "identifiedNeeds",
            risks_and_triggers as "risksAndTriggers",
            goals,
            interventions,
            patient_views as "patientViews",
            review_date as "reviewDate",
            additional_notes as "additionalNotes",
            created_by_staff_id as "createdByStaffId",
            created_by_name as "createdByName",
            created_by_staff_code as "createdByStaffCode",
            created_at as "createdAt"
        `,
        [
          plan.id,
          plan.organisationId,
          plan.patientId,
          plan.wardId,
          plan.title,
          plan.identifiedNeeds,
          plan.risksAndTriggers,
          plan.goals,
          plan.interventions,
          plan.patientViews,
          plan.reviewDate,
          plan.additionalNotes,
          plan.createdByStaffId,
          plan.createdByName,
          plan.createdByStaffCode,
          plan.createdAt
        ]
      );

      if (!result.rows[0]) {
        response.status(409).json({ error: "Patient care plan already exists" });
        return;
      }

      await recordAuditEvent({
        organisationId,
        actorStaffId: authenticatedStaff.id,
        actorStaffCode: authenticatedStaff.staffCode,
        eventType: "patient_care_plan.save",
        entityType: "patient_care_plan",
        entityId: plan.id,
        details: {
          patientId: plan.patientId,
          wardId: plan.wardId,
          title: plan.title,
          reviewDate: plan.reviewDate
        }
      });
      response.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/security-checks", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          id,
          area_id as "areaId",
          check_name as "checkName",
          checked_by as "checkedBy",
          checked_at as "checkedAt",
          notes,
          counted_total as "countedTotal",
          result_details as "resultDetails"
        from security_checks
        where organisation_id = $1
        order by checked_at desc
      `,
      [organisationId]
    );

    response.json({ securityChecks: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/security-checks", requireStaffRole([...anyWardStaff]), async (request, response, next) => {
  try {
    const parsed = securityCheckSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid security check", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const check = { ...parsed.data, organisationId, id: parsed.data.id ?? `security-${Date.now()}` };
    const result = await pool.query(
      `
        insert into security_checks (
          id, organisation_id, area_id, check_name, checked_by, checked_at, notes, counted_total, result_details
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        on conflict (id) do update set
          notes = excluded.notes,
          counted_total = excluded.counted_total,
          result_details = excluded.result_details
        returning
          id,
          area_id as "areaId",
          check_name as "checkName",
          checked_by as "checkedBy",
          checked_at as "checkedAt",
          notes,
          counted_total as "countedTotal",
          result_details as "resultDetails"
      `,
      [
        check.id,
        check.organisationId,
        check.areaId,
        check.checkName,
        check.checkedBy,
        check.checkedAt,
        check.notes,
        check.countedTotal ?? null,
        JSON.stringify(check.resultDetails ?? {})
      ]
    );

    await recordAuditEvent({
      organisationId: check.organisationId,
      ...auditActorFromBody(request.body),
      eventType: "security_check.save",
      entityType: "security_check",
      entityId: check.id,
      details: { areaId: check.areaId, checkName: check.checkName }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/news2-readings", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          recorded_at as "recordedAt",
          recorded_by as "recordedBy",
          respiration_rate as "respirationRate",
          spo2,
          spo2_scale as "spo2Scale",
          on_oxygen as "onOxygen",
          systolic_bp as "systolicBp",
          pulse,
          consciousness,
          temperature::float as temperature,
          total_score as "totalScore"
        from news2_readings
        where organisation_id = $1
        order by recorded_at desc
      `,
      [organisationId]
    );

    response.json({ news2Readings: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/news2-readings", requireStaffRole(["nurse", "manager", "doctor"]), async (request, response, next) => {
  try {
    const parsed = news2ReadingSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid NEWS2 reading", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const reading = { ...parsed.data, organisationId, id: parsed.data.id ?? `news2-${Date.now()}` };
    const result = await pool.query(
      `
        insert into news2_readings (
          id, organisation_id, patient_id, recorded_at, recorded_by, respiration_rate, spo2, spo2_scale,
          on_oxygen, systolic_bp, pulse, consciousness, temperature, total_score
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (id) do nothing
        returning
          id,
          patient_id as "patientId",
          recorded_at as "recordedAt",
          recorded_by as "recordedBy",
          respiration_rate as "respirationRate",
          spo2,
          spo2_scale as "spo2Scale",
          on_oxygen as "onOxygen",
          systolic_bp as "systolicBp",
          pulse,
          consciousness,
          temperature::float as temperature,
          total_score as "totalScore"
      `,
      [
        reading.id,
        reading.organisationId,
        reading.patientId,
        reading.recordedAt,
        reading.recordedBy,
        reading.respirationRate,
        reading.spo2,
        reading.spo2Scale,
        reading.onOxygen,
        reading.systolicBp,
        reading.pulse,
        reading.consciousness,
        reading.temperature,
        reading.totalScore
      ]
    );

    await recordAuditEvent({
      organisationId: reading.organisationId,
      ...auditActorFromBody(request.body),
      eventType: "news2.save",
      entityType: "news2_reading",
      entityId: reading.id,
      details: { patientId: reading.patientId, totalScore: reading.totalScore }
    });
    response.status(201).json(result.rows[0] ?? reading);
  } catch (error) {
    next(error);
  }
});

router.get("/food-fluid-entries", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          recorded_at as "recordedAt",
          recorded_by as "recordedBy",
          meal_period as "mealPeriod",
          entry_type as "entryType",
          item_description as "itemDescription",
          portion_offered as "portionOffered",
          intake_level as "intakeLevel",
          fluid_offered_ml as "fluidOfferedMl",
          fluid_taken_ml as "fluidTakenMl",
          assistance_notes as "assistanceNotes",
          comments
        from food_fluid_entries
        where organisation_id = $1
        order by recorded_at desc
      `,
      [organisationId]
    );

    response.json({ foodFluidEntries: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/food-fluid-entries",
  requireStaffRole([...anyWardStaff]),
  async (request, response, next) => {
    try {
      const parsed = foodFluidEntrySchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(400).json({ error: "Invalid food or fluid entry", details: parsed.error.flatten() });
        return;
      }

      const organisationId = requireOrganisationId(request, response);
      if (!organisationId) return;
      const entry = {
        ...parsed.data,
        organisationId,
        id: parsed.data.id ?? `food-fluid-${Date.now()}`
      };
      const result = await pool.query(
        `
          insert into food_fluid_entries (
            id, organisation_id, patient_id, recorded_at, recorded_by, meal_period, entry_type,
            item_description, portion_offered, intake_level, fluid_offered_ml, fluid_taken_ml,
            assistance_notes, comments
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          on conflict (id) do nothing
          returning
            id,
            patient_id as "patientId",
            recorded_at as "recordedAt",
            recorded_by as "recordedBy",
            meal_period as "mealPeriod",
            entry_type as "entryType",
            item_description as "itemDescription",
            portion_offered as "portionOffered",
            intake_level as "intakeLevel",
            fluid_offered_ml as "fluidOfferedMl",
            fluid_taken_ml as "fluidTakenMl",
            assistance_notes as "assistanceNotes",
            comments
        `,
        [
          entry.id,
          entry.organisationId,
          entry.patientId,
          entry.recordedAt,
          entry.recordedBy,
          entry.mealPeriod,
          entry.entryType,
          entry.itemDescription,
          entry.portionOffered,
          entry.intakeLevel,
          entry.fluidOfferedMl ?? null,
          entry.fluidTakenMl ?? null,
          entry.assistanceNotes,
          entry.comments
        ]
      );

      await recordAuditEvent({
        organisationId: entry.organisationId,
        ...auditActorFromBody(request.body),
        eventType: "food_fluid.save",
        entityType: "food_fluid_entry",
        entityId: entry.id,
        details: {
          patientId: entry.patientId,
          mealPeriod: entry.mealPeriod,
          entryType: entry.entryType,
          intakeLevel: entry.intakeLevel,
          fluidTakenMl: entry.fluidTakenMl
        }
      });
      response.status(201).json(result.rows[0] ?? entry);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/medication-prescriptions", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          drug_name as "drugName",
          dose,
          route,
          prescription_type as "prescriptionType",
          prn_indication as "prnIndication",
          depot_interval_days as "depotIntervalDays",
          administration_times as "administrationTimes",
          start_date as "startDate",
          stop_date as "stopDate",
          additional_instructions as "additionalInstructions",
          prescribed_by as "prescribedBy",
          prescribed_at as "prescribedAt",
          discontinued_by as "discontinuedBy",
          discontinued_at as "discontinuedAt",
          discontinue_reason as "discontinueReason"
        from medication_prescriptions
        where organisation_id = $1
        order by prescribed_at desc
      `,
      [organisationId]
    );

    response.json({ medicationPrescriptions: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/medication-prescriptions", requirePrescriber(), async (request, response, next) => {
  try {
    const parsed = medicationPrescriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid medication prescription", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const prescription = { ...parsed.data, organisationId, id: parsed.data.id ?? `med-prescription-${Date.now()}` };
    const result = await pool.query(
      `
        insert into medication_prescriptions (
          id, organisation_id, patient_id, drug_name, dose, route, prescription_type, prn_indication, depot_interval_days,
          administration_times, start_date, stop_date,
          additional_instructions, prescribed_by, prescribed_at, discontinued_by, discontinued_at, discontinue_reason
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        on conflict (id) do update set
          stop_date = excluded.stop_date,
          discontinued_by = excluded.discontinued_by,
          discontinued_at = excluded.discontinued_at,
          discontinue_reason = excluded.discontinue_reason,
          updated_at = now()
        returning
          id,
          patient_id as "patientId",
          drug_name as "drugName",
          dose,
          route,
          prescription_type as "prescriptionType",
          prn_indication as "prnIndication",
          depot_interval_days as "depotIntervalDays",
          administration_times as "administrationTimes",
          start_date as "startDate",
          stop_date as "stopDate",
          additional_instructions as "additionalInstructions",
          prescribed_by as "prescribedBy",
          prescribed_at as "prescribedAt",
          discontinued_by as "discontinuedBy",
          discontinued_at as "discontinuedAt",
          discontinue_reason as "discontinueReason"
      `,
      [
        prescription.id,
        prescription.organisationId,
        prescription.patientId,
        prescription.drugName,
        prescription.dose,
        prescription.route,
        prescription.prescriptionType,
        prescription.prnIndication ?? null,
        prescription.depotIntervalDays ?? null,
        prescription.administrationTimes,
        prescription.startDate,
        prescription.stopDate ?? null,
        prescription.additionalInstructions,
        prescription.prescribedBy,
        prescription.prescribedAt,
        prescription.discontinuedBy ?? null,
        prescription.discontinuedAt ?? null,
        prescription.discontinueReason ?? null
      ]
    );

    await recordAuditEvent({
      organisationId: prescription.organisationId,
      ...auditActorFromBody(request.body),
      eventType: prescription.discontinuedAt ? "medication.discontinue" : "medication.prescribe",
      entityType: "medication_prescription",
      entityId: prescription.id,
      details: { patientId: prescription.patientId, drugName: prescription.drugName }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/medication-administrations", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `
        select
          id,
          prescription_id as "prescriptionId",
          patient_id as "patientId",
          scheduled_at as "scheduledAt",
          status,
          omission_code as "omissionCode",
          recorded_by as "recordedBy",
          recorded_at as "recordedAt",
          notes
        from medication_administrations
        where organisation_id = $1
        order by recorded_at desc
      `,
      [organisationId]
    );

    response.json({ medicationAdministrations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/medication-administrations", requireStaffRole(["nurse", "manager", "doctor"]), async (request, response, next) => {
  try {
    const parsed = medicationAdministrationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid medication administration", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const administration = { ...parsed.data, organisationId, id: parsed.data.id ?? `med-admin-${Date.now()}` };
    const existingResult = await pool.query(
      `
        select
          status,
          omission_code as "omissionCode",
          recorded_by as "recordedBy",
          recorded_at as "recordedAt",
          notes
        from medication_administrations
        where organisation_id = $1 and id = $2
      `,
      [organisationId, administration.id]
    );
    const existingAdministration = existingResult.rows[0] as
      | {
          status?: string;
          omissionCode?: string;
          recordedBy?: string;
          recordedAt?: string;
          notes?: string;
        }
      | undefined;
    const result = await pool.query(
      `
        insert into medication_administrations (
          id, organisation_id, prescription_id, patient_id, scheduled_at, status, omission_code,
          recorded_by, recorded_at, notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (id) do update set
          scheduled_at = excluded.scheduled_at,
          status = excluded.status,
          omission_code = excluded.omission_code,
          recorded_by = excluded.recorded_by,
          recorded_at = excluded.recorded_at,
          notes = excluded.notes
        returning
          id,
          prescription_id as "prescriptionId",
          patient_id as "patientId",
          scheduled_at as "scheduledAt",
          status,
          omission_code as "omissionCode",
          recorded_by as "recordedBy",
          recorded_at as "recordedAt",
          notes
      `,
      [
        administration.id,
        administration.organisationId,
        administration.prescriptionId,
        administration.patientId,
        administration.scheduledAt,
        administration.status,
        administration.omissionCode ?? null,
        administration.recordedBy,
        administration.recordedAt,
        administration.notes
      ]
    );

    await recordAuditEvent({
      organisationId: administration.organisationId,
      ...auditActorFromBody(request.body),
      eventType: existingAdministration ? "medication.administration.correct" : "medication.administration",
      entityType: "medication_administration",
      entityId: administration.id,
      details: {
        patientId: administration.patientId,
        prescriptionId: administration.prescriptionId,
        scheduledAt: administration.scheduledAt,
        previous: existingAdministration ?? null,
        next: {
          status: administration.status,
          omissionCode: administration.omissionCode ?? null,
          recordedBy: administration.recordedBy,
          recordedAt: administration.recordedAt,
          notes: administration.notes
        }
      }
    });
    response.status(201).json(result.rows[0] ?? administration);
  } catch (error) {
    next(error);
  }
});

router.get("/missed-observations", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const wardId = typeof request.query.wardId === "string" ? request.query.wardId : undefined;
    const result = await pool.query(
      `
        select
          id,
          patient_id as "patientId",
          patient_name as "patientName",
          ward_id as "wardId",
          source,
          due_at as "dueAt",
          recorded_at as "recordedAt",
          allocated_staff_id as "allocatedStaffId",
          allocated_staff_name as "allocatedStaffName",
          recorded_by_staff_id as "recordedByStaffId",
          recorded_by_name as "recordedByName",
          reason,
          details
        from missed_observations
        where organisation_id = $1
          and ($2::text is null or ward_id = $2::text)
        order by due_at desc
        limit 100
      `,
      [organisationId, wardId ?? null]
    );

    response.json({ missedObservations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/missed-observations", requireStaffRole([...anyWardStaff]), async (request, response, next) => {
  try {
    const parsed = missedObservationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid missed observation", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const missedObservation = {
      ...parsed.data,
      organisationId,
      id: parsed.data.id ?? `missed-observation-${Date.now()}`
    };

    const result = await pool.query(
      `
        insert into missed_observations (
          id, organisation_id, patient_id, patient_name, ward_id, source, due_at, recorded_at,
          allocated_staff_id, allocated_staff_name, recorded_by_staff_id, recorded_by_name, reason, details
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (id) do nothing
        returning
          id,
          patient_id as "patientId",
          patient_name as "patientName",
          ward_id as "wardId",
          source,
          due_at as "dueAt",
          recorded_at as "recordedAt",
          allocated_staff_id as "allocatedStaffId",
          allocated_staff_name as "allocatedStaffName",
          recorded_by_staff_id as "recordedByStaffId",
          recorded_by_name as "recordedByName",
          reason,
          details
      `,
      [
        missedObservation.id,
        missedObservation.organisationId,
        missedObservation.patientId,
        missedObservation.patientName,
        missedObservation.wardId,
        missedObservation.source,
        missedObservation.dueAt,
        missedObservation.recordedAt,
        missedObservation.allocatedStaffId ?? null,
        missedObservation.allocatedStaffName,
        missedObservation.recordedByStaffId ?? null,
        missedObservation.recordedByName,
        missedObservation.reason,
        missedObservation.details
      ]
    );

    await recordAuditEvent({
      organisationId: missedObservation.organisationId,
      actorStaffId: missedObservation.actorStaffId ?? missedObservation.recordedByStaffId,
      actorStaffCode: missedObservation.actorStaffCode,
      eventType: "observation.missed",
      entityType: "missed_observation",
      entityId: missedObservation.id,
      details: {
        patientId: missedObservation.patientId,
        patientName: missedObservation.patientName,
        source: missedObservation.source,
        reason: missedObservation.reason
      }
    });
    response.status(201).json(result.rows[0] ?? missedObservation);
  } catch (error) {
    next(error);
  }
});

router.get("/rota-assignments", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const wardId = typeof request.query.wardId === "string" ? request.query.wardId : undefined;
    const result = await pool.query(
      `
        select
          id,
          ward_id as "wardId",
          staff_id as "staffId",
          role,
          starts_at as "startsAt",
          ends_at as "endsAt",
          patient_id as "patientId",
          notes
        from rota_assignments
        where organisation_id = $1
          and ($2::text is null or ward_id = $2::text)
        order by starts_at asc
      `,
      [organisationId, wardId ?? null]
    );

    response.json({ rotaAssignments: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/rota-assignments", requireStaffRole(["nurse", "manager"]), async (request, response, next) => {
  try {
    const parsed = rotaAssignmentSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid rota assignment", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const assignment = { ...parsed.data, organisationId };
    const result = await pool.query(
      `
        insert into rota_assignments (
          id, organisation_id, ward_id, staff_id, role, starts_at, ends_at, patient_id, notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (id) do update set
          ward_id = excluded.ward_id,
          staff_id = excluded.staff_id,
          role = excluded.role,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          patient_id = excluded.patient_id,
          notes = excluded.notes,
          updated_at = now()
        returning
          id,
          ward_id as "wardId",
          staff_id as "staffId",
          role,
          starts_at as "startsAt",
          ends_at as "endsAt",
          patient_id as "patientId",
          notes
      `,
      [
        assignment.id,
        assignment.organisationId,
        assignment.wardId,
        assignment.staffId,
        assignment.role,
        assignment.startsAt,
        assignment.endsAt,
        assignment.patientId ?? null,
        assignment.notes
      ]
    );

    await recordAuditEvent({
      organisationId: assignment.organisationId,
      ...auditActorFromBody(request.body),
      eventType: "rota.assignment.upsert",
      entityType: "rota_assignment",
      entityId: assignment.id,
      details: { wardId: assignment.wardId, staffId: assignment.staffId, role: assignment.role }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete("/rota-assignments/:id", requireStaffRole(["nurse", "manager"]), async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const assignmentId = String(request.params.id);
    await pool.query("delete from rota_assignments where organisation_id = $1 and id = $2", [organisationId, assignmentId]);
    await recordAuditEvent({
      organisationId,
      eventType: "rota.assignment.delete",
      entityType: "rota_assignment",
      entityId: assignmentId
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/staff-shift-assignments", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const wardId = typeof request.query.wardId === "string" ? request.query.wardId : undefined;
    const date = typeof request.query.date === "string" ? request.query.date : undefined;
    const result = await pool.query(
      `
        select
          id,
          ward_id as "wardId",
          shift_id as "shiftId",
          staff_id as "staffId",
          date,
          nurse_in_charge as "nurseInCharge",
          medication_nurse as "medicationNurse"
        from staff_shift_assignments
        where organisation_id = $1
          and ($2::text is null or ward_id = $2::text)
          and ($3::text is null or date = $3::text)
        order by date desc, shift_id asc
      `,
      [organisationId, wardId ?? null, date ?? null]
    );

    response.json({ staffShiftAssignments: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/staff-shift-assignments", requireStaffRole(["nurse", "manager"]), async (request, response, next) => {
  try {
    const parsed = staffShiftAssignmentSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid staff shift assignment", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const assignment = { ...parsed.data, organisationId };
    if (assignment.nurseInCharge || assignment.medicationNurse) {
      const assignedStaffResult = await pool.query(
        "select role from staff_members where organisation_id = $1 and id::text = $2",
        [organisationId, assignment.staffId]
      );
      if (!assignedStaffResult.rowCount) {
        response.status(404).json({ error: "Assigned staff member not found" });
        return;
      }
      if (assignedStaffResult.rows[0]?.role === "hcf") {
        response.status(400).json({ error: "HCF staff cannot be Nurse in Charge or Medication Nurse" });
        return;
      }
    }

    const result = await pool.query(
      `
        insert into staff_shift_assignments (
          id, organisation_id, ward_id, shift_id, staff_id, date, nurse_in_charge, medication_nurse
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set
          ward_id = excluded.ward_id,
          shift_id = excluded.shift_id,
          staff_id = excluded.staff_id,
          date = excluded.date,
          nurse_in_charge = excluded.nurse_in_charge,
          medication_nurse = excluded.medication_nurse,
          updated_at = now()
        returning
          id,
          ward_id as "wardId",
          shift_id as "shiftId",
          staff_id as "staffId",
          date,
          nurse_in_charge as "nurseInCharge",
          medication_nurse as "medicationNurse"
      `,
      [
        assignment.id,
        assignment.organisationId,
        assignment.wardId,
        assignment.shiftId,
        assignment.staffId,
        assignment.date,
        assignment.nurseInCharge ?? false,
        assignment.medicationNurse ?? false
      ]
    );

    await recordAuditEvent({
      organisationId: assignment.organisationId,
      ...auditActorFromBody(request.body),
      eventType: "staff_cover.assignment.upsert",
      entityType: "staff_shift_assignment",
      entityId: assignment.id,
      details: { wardId: assignment.wardId, shiftId: assignment.shiftId, staffId: assignment.staffId }
    });
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete("/staff-shift-assignments/:id", requireStaffRole(["nurse", "manager"]), async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const assignmentId = String(request.params.id);
    await pool.query("delete from staff_shift_assignments where organisation_id = $1 and id = $2", [
      organisationId,
      assignmentId
    ]);
    await recordAuditEvent({
      organisationId,
      eventType: "staff_cover.assignment.delete",
      entityType: "staff_shift_assignment",
      entityId: assignmentId
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/audit-events", requireStaffRole(["super_admin"]), async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const limit = Math.min(Number(request.query.limit ?? 100), 250);
    const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
    const eventType = typeof request.query.eventType === "string" ? request.query.eventType.trim() : "";
    const outcome = typeof request.query.outcome === "string" ? request.query.outcome.trim() : "";
    const result = await pool.query(
      `
        select
          id,
          actor_staff_id as "actorStaffId",
          actor_staff_code as "actorStaffCode",
          event_type as "eventType",
          entity_type as "entityType",
          entity_id as "entityId",
          outcome,
          details,
          occurred_at as "occurredAt"
        from audit_events
        where organisation_id = $1
          and ($2::text = '' or event_type = $2::text or event_type like $2::text || '.%')
          and ($3::text = '' or outcome = $3::text)
          and (
            $4::text = ''
            or actor_staff_code ilike '%' || $4::text || '%'
            or event_type ilike '%' || $4::text || '%'
            or entity_type ilike '%' || $4::text || '%'
            or entity_id ilike '%' || $4::text || '%'
            or details::text ilike '%' || $4::text || '%'
          )
        order by occurred_at desc
        limit $5
      `,
      [organisationId, eventType, outcome, search, limit]
    );

    response.json({ auditEvents: result.rows });
  } catch (error) {
    next(error);
  }
});

export { router as activityRouter };
