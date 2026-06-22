import { Router } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();

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
  countedTotal: z.number().int().nonnegative().optional()
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

const medicationPrescriptionSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientId: z.string().min(1),
  drugName: z.string().min(1),
  dose: z.string().min(1),
  route: z.string().min(1),
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

router.post("/observations", async (request, response, next) => {
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
          counted_total as "countedTotal"
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

router.post("/security-checks", async (request, response, next) => {
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
          id, organisation_id, area_id, check_name, checked_by, checked_at, notes, counted_total
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        on conflict (id) do update set
          notes = excluded.notes,
          counted_total = excluded.counted_total
        returning
          id,
          area_id as "areaId",
          check_name as "checkName",
          checked_by as "checkedBy",
          checked_at as "checkedAt",
          notes,
          counted_total as "countedTotal"
      `,
      [
        check.id,
        check.organisationId,
        check.areaId,
        check.checkName,
        check.checkedBy,
        check.checkedAt,
        check.notes,
        check.countedTotal ?? null
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

router.post("/news2-readings", async (request, response, next) => {
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

router.post("/medication-prescriptions", async (request, response, next) => {
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
          id, organisation_id, patient_id, drug_name, dose, route, administration_times, start_date, stop_date,
          additional_instructions, prescribed_by, prescribed_at, discontinued_by, discontinued_at, discontinue_reason
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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

router.post("/medication-administrations", async (request, response, next) => {
  try {
    const parsed = medicationAdministrationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid medication administration", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const administration = { ...parsed.data, organisationId, id: parsed.data.id ?? `med-admin-${Date.now()}` };
    const result = await pool.query(
      `
        insert into medication_administrations (
          id, organisation_id, prescription_id, patient_id, scheduled_at, status, omission_code,
          recorded_by, recorded_at, notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict (id) do nothing
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
      eventType: "medication.administration",
      entityType: "medication_administration",
      entityId: administration.id,
      details: { patientId: administration.patientId, status: administration.status }
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

router.post("/missed-observations", async (request, response, next) => {
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
          id, organisation_id, patient_id, patient_name, ward_id, due_at, recorded_at,
          allocated_staff_id, allocated_staff_name, recorded_by_staff_id, recorded_by_name, reason, details
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        on conflict (id) do nothing
        returning
          id,
          patient_id as "patientId",
          patient_name as "patientName",
          ward_id as "wardId",
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
        reason: missedObservation.reason
      }
    });
    response.status(201).json(result.rows[0] ?? missedObservation);
  } catch (error) {
    next(error);
  }
});

router.get("/audit-events", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const limit = Math.min(Number(request.query.limit ?? 100), 250);
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
        order by occurred_at desc
        limit $2
      `,
      [organisationId, limit]
    );

    response.json({ auditEvents: result.rows });
  } catch (error) {
    next(error);
  }
});

export { router as activityRouter };
