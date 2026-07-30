import { Router, type Response } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();

const patientVoiceProfileSchema = z.object({
  whatMatters: z.string().max(10_000),
  careGoals: z.string().max(10_000),
  communicationNeeds: z.string().max(10_000),
  sensoryNeeds: z.string().max(10_000),
  culturalSpiritualNeeds: z.string().max(10_000),
  dietaryNeeds: z.string().max(10_000),
  accessibilityNeeds: z.string().max(10_000),
  distressSupport: z.string().max(10_000),
  preferredInvolvement: z.string().max(10_000),
  updatedAt: z.string().datetime(),
  updatedWithPatient: z.boolean(),
  recordedByStaffId: z.string().min(1),
  recordedByName: z.string().min(1).max(255)
});

const patientVoiceRatingSchema = z.number().int().min(1).max(5);
const patientVoiceCheckInSchema = z.object({
  id: z.string().min(1),
  frequency: z.enum(["Initial", "Weekly", "Monthly"]),
  foodRating: patientVoiceRatingSchema,
  staffSupportRating: patientVoiceRatingSchema,
  accommodationRating: patientVoiceRatingSchema,
  activitiesRating: patientVoiceRatingSchema,
  safetyRating: patientVoiceRatingSchema,
  overallRating: patientVoiceRatingSchema,
  goingWell: z.string().max(10_000),
  wouldChange: z.string().max(10_000),
  needsChanged: z.string().max(10_000),
  concerns: z.string().max(10_000),
  completedBy: z.enum(["Patient", "Patient with support"]),
  submittedAt: z.string().datetime(),
  witnessedByStaffId: z.string().min(1),
  witnessedByName: z.string().min(1).max(255),
  staffResponse: z.string().max(10_000).optional(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedByStaffId: z.string().optional(),
  acknowledgedByName: z.string().max(255).optional()
});

const familyShareCategorySchema = z.enum([
  "Patient voice",
  "Progress summary",
  "Care-plan goals",
  "Approved notes"
]);
const familyPortalContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  relationship: z.string().min(1).max(255),
  categories: z.array(familyShareCategorySchema).max(4),
  active: z.boolean(),
  canContribute: z.boolean(),
  accessExpiresAt: z.string().max(50).optional()
});
const familySharingSchema = z.object({
  patientConsented: z.boolean(),
  consentNotes: z.string().max(10_000),
  consentRecordedAt: z.string().datetime().optional(),
  consentRecordedByStaffId: z.string().optional(),
  consentRecordedByName: z.string().max(255).optional(),
  consentReviewDate: z.string().max(50).optional(),
  contacts: z.array(familyPortalContactSchema).max(50),
  sharedNoteIds: z.array(z.string().min(1)).max(500)
});
const familyContributionSchema = z.object({
  id: z.string().min(1),
  contactId: z.string().min(1),
  contactName: z.string().min(1).max(255),
  body: z.string().min(1).max(20_000),
  submittedAt: z.string().datetime(),
  recordedByStaffId: z.string().min(1).optional(),
  recordedByName: z.string().min(1).max(255).optional(),
  source: z.enum(["Family portal", "Ward tablet"]).optional(),
  reviewStatus: z.enum(["Awaiting staff review", "Reviewed"]).optional(),
  staffReviewNote: z.string().max(10_000).optional(),
  reviewedAt: z.string().datetime().optional(),
  reviewedByStaffId: z.string().min(1).optional(),
  reviewedByName: z.string().min(1).max(255).optional()
});

const patientSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientNumber: z.number().int().nonnegative(),
  hospitalNumber: z.string().min(1),
  firstName: z.string().min(1),
  surname: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
  nextOfKinName: z.string().max(255).default(""),
  nextOfKinRelationship: z.string().max(255).default(""),
  nextOfKinTelephone: z.string().max(100).default(""),
  nextOfKinEmail: z.string().email().or(z.literal("")).default(""),
  wardId: z.string().min(1),
  roomNumber: z.number().int().nonnegative(),
  observationLevel: z.string().default("Intermittent"),
  latestObservationPlace: z.string().default("Side room"),
  latestObservationTime: z.string().datetime().optional(),
  latestObservedBy: z.string().default(""),
  latestPresentation: z.string().default("Awake"),
  onOffWard: z.enum(["On ward", "Off ward"]).default("On ward"),
  seclusion: z.boolean().default(false),
  longTermSeclusion: z.boolean().default(false),
  allergies: z.string().default(""),
  adverseDrugReactions: z.string().default(""),
  archived: z.boolean().default(false),
  enhancedObservation: z.record(z.string(), z.unknown()).nullable().optional().transform((value) => value ?? undefined),
  tesoHistory: z.array(z.record(z.string(), z.unknown())).default([]),
  patientForms: z.array(z.record(z.string(), z.unknown())).default([]),
  patientVoiceProfile: patientVoiceProfileSchema.nullable().optional().transform((value) => value ?? undefined),
  patientVoiceCheckIns: z.array(patientVoiceCheckInSchema).max(1000).default([]),
  familySharing: familySharingSchema.nullable().optional().transform((value) => value ?? undefined),
  familyContributions: z.array(familyContributionSchema).max(1000).default([]),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
});

const patientMovementSchema = z.object({
  organisationId: optionalOrganisationIdSchema,
  reason: z.string().trim().min(3).max(2000),
  wardId: z.string().min(1).optional()
});

router.get("/", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const includeArchived = request.query.includeArchived === "true";
    const result = await pool.query(
      `
        select
          id,
          patient_number as "patientNumber",
          hospital_number as "hospitalNumber",
          first_name as "firstName",
          surname,
          coalesce(date_of_birth::text, '') as "dateOfBirth",
          next_of_kin_name as "nextOfKinName",
          next_of_kin_relationship as "nextOfKinRelationship",
          next_of_kin_telephone as "nextOfKinTelephone",
          next_of_kin_email as "nextOfKinEmail",
          ward_id as "wardId",
          room_number as "roomNumber",
          observation_level as "observationLevel",
          latest_observation_place as "latestObservationPlace",
          latest_observation_time as "latestObservationTime",
          latest_observed_by as "latestObservedBy",
          latest_presentation as "latestPresentation",
          on_off_ward as "onOffWard",
          seclusion,
          long_term_seclusion as "longTermSeclusion",
          allergies,
          adverse_drug_reactions as "adverseDrugReactions",
          enhanced_observation as "enhancedObservation",
          teso_history as "tesoHistory",
          patient_forms as "patientForms",
          patient_voice_profile as "patientVoiceProfile",
          patient_voice_check_ins as "patientVoiceCheckIns",
          family_sharing as "familySharing",
          family_contributions as "familyContributions",
          archived
        from patients
        where organisation_id = $1
          and ($2::boolean = true or archived = false)
        order by ward_id asc, room_number asc, surname asc
      `,
      [organisationId, includeArchived]
    );

    response.json({ patients: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/transfer", requireStaffRole(["manager", "super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const parsed = patientMovementSchema.safeParse(request.body);
    if (!parsed.success || !parsed.data.wardId) {
      response.status(400).json({ error: "Destination ward and transfer reason are required" });
      return;
    }
    const patientId = readPatientId(request, response);
    if (!patientId) return;
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const destination = await pool.query(
      `select wards.name, sites.organisation_id
       from wards inner join sites on sites.id = wards.site_id where wards.id = $1`,
      [parsed.data.wardId]
    );
    if (!destination.rows[0] || destination.rows[0].organisation_id !== organisationId) {
      response.status(403).json({ error: "The destination ward does not belong to this organisation" });
      return;
    }
    const current = await pool.query(
      `select patients.ward_id as "wardId", wards.name as "wardName"
       from patients left join wards on wards.id = patients.ward_id
       where patients.id = $1 and patients.organisation_id = $2 and patients.archived = false`,
      [patientId, organisationId]
    );
    if (!current.rows[0]) {
      response.status(404).json({ error: "Active patient not found" });
      return;
    }
    await pool.query(
      `update patients set ward_id = $1, on_off_ward = 'On ward',
       latest_observation_place = 'Side room', updated_at = now()
       where id = $2 and organisation_id = $3`,
      [parsed.data.wardId, patientId, organisationId]
    );
    const patient = await loadPatient(organisationId, patientId);
    await recordMovementAudit(request, organisationId, patientId, "patient.transfer", {
      reason: parsed.data.reason,
      fromWardId: current.rows[0].wardId,
      fromWardName: current.rows[0].wardName,
      toWardId: parsed.data.wardId,
      toWardName: destination.rows[0].name
    });
    response.json({ patient });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/archive", requireStaffRole(["manager", "super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const parsed = patientMovementSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Archive reason is required" });
      return;
    }
    const patientId = readPatientId(request, response);
    if (!patientId) return;
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const result = await pool.query(
      `update patients set archived = true, updated_at = now()
       where id = $1 and organisation_id = $2 and archived = false returning id, ward_id as "wardId"`,
      [patientId, organisationId]
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Active patient not found" });
      return;
    }
    const patient = await loadPatient(organisationId, patientId);
    await recordMovementAudit(request, organisationId, patientId, "patient.archive", {
      reason: parsed.data.reason,
      wardId: result.rows[0].wardId
    });
    response.json({ patient });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/restore", requireStaffRole(["manager", "super_admin"]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const parsed = patientMovementSchema.safeParse(request.body);
    if (!parsed.success || !parsed.data.wardId) {
      response.status(400).json({ error: "Destination ward and restoration reason are required" });
      return;
    }
    const patientId = readPatientId(request, response);
    if (!patientId) return;
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const destination = await pool.query(
      `select wards.name, sites.organisation_id
       from wards inner join sites on sites.id = wards.site_id where wards.id = $1`,
      [parsed.data.wardId]
    );
    if (!destination.rows[0] || destination.rows[0].organisation_id !== organisationId) {
      response.status(403).json({ error: "The destination ward does not belong to this organisation" });
      return;
    }
    const result = await pool.query(
      `update patients set archived = false, ward_id = $1, on_off_ward = 'On ward',
       latest_observation_place = 'Side room', updated_at = now()
       where id = $2 and organisation_id = $3 and archived = true returning id`,
      [parsed.data.wardId, patientId, organisationId]
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Archived patient not found" });
      return;
    }
    const patient = await loadPatient(organisationId, patientId);
    await recordMovementAudit(request, organisationId, patientId, "patient.restore", {
      reason: parsed.data.reason,
      toWardId: parsed.data.wardId,
      toWardName: destination.rows[0].name
    });
    response.json({ patient });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireStaffRole(["nurse", "manager", "doctor", "super_admin"]), async (request, response, next) => {
  try {
    const parsed = patientSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Invalid patient", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;

    const targetWard = await pool.query(
      `select sites.organisation_id
       from wards inner join sites on sites.id = wards.site_id
       where wards.id = $1`,
      [parsed.data.wardId]
    );
    if (!targetWard.rows[0] || targetWard.rows[0].organisation_id !== organisationId) {
      response.status(403).json({ error: "The destination ward does not belong to this organisation" });
      return;
    }
    if (parsed.data.id) {
      const existingOwner = await pool.query("select organisation_id from patients where id = $1", [parsed.data.id]);
      if (existingOwner.rows[0] && existingOwner.rows[0].organisation_id !== organisationId) {
        response.status(403).json({ error: "This patient belongs to a different organisation" });
        return;
      }
    }

    const patient = {
      ...parsed.data,
      organisationId,
      id: parsed.data.id ?? createPatientId(parsed.data.hospitalNumber, parsed.data.firstName, parsed.data.surname),
      latestObservationTime: parsed.data.latestObservationTime ?? new Date().toISOString()
    };
    const existingResult = await pool.query(
      `
        select
          ward_id as "wardId",
          archived,
          observation_level as "observationLevel",
          allergies,
          adverse_drug_reactions as "adverseDrugReactions",
          enhanced_observation as "enhancedObservation",
          teso_history as "tesoHistory",
          patient_forms as "patientForms",
          patient_voice_profile as "patientVoiceProfile",
          patient_voice_check_ins as "patientVoiceCheckIns",
          family_sharing as "familySharing",
          family_contributions as "familyContributions"
        from patients
        where organisation_id = $1 and id = $2
      `,
      [organisationId, patient.id]
    );
    const existingPatient = existingResult.rows[0] as
      | {
          wardId?: string;
          archived?: boolean;
          observationLevel?: string;
          allergies?: string;
          adverseDrugReactions?: string;
          enhancedObservation?: unknown;
          tesoHistory?: unknown[];
          patientForms?: unknown[];
          patientVoiceProfile?: unknown;
          patientVoiceCheckIns?: unknown[];
          familySharing?: unknown;
          familyContributions?: unknown[];
        }
      | undefined;

    if (
      existingPatient &&
      (existingPatient.wardId !== patient.wardId || Boolean(existingPatient.archived) !== Boolean(patient.archived))
    ) {
      response.status(403).json({
        error: "Ward transfers, archiving and restoration require the dedicated manager-authorised action"
      });
      return;
    }

    const result = await pool.query(
      `
        insert into patients (
          id, organisation_id, patient_number, hospital_number, first_name, surname,
          date_of_birth, next_of_kin_name, next_of_kin_relationship, next_of_kin_telephone, next_of_kin_email,
          ward_id, room_number,
          observation_level, latest_observation_place, latest_observation_time, latest_observed_by,
          latest_presentation, on_off_ward, seclusion, long_term_seclusion, archived,
          allergies, adverse_drug_reactions, enhanced_observation, teso_history, patient_forms,
          patient_voice_profile, patient_voice_check_ins, family_sharing, family_contributions
        ) values (
          $1,$2,$3,$4,$5,$6,nullif($7, '')::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
          $25::jsonb,$26::jsonb,$27::jsonb,$28::jsonb,$29::jsonb,$30::jsonb,$31::jsonb
        )
        on conflict (id) do update set
          patient_number = excluded.patient_number,
          hospital_number = excluded.hospital_number,
          first_name = excluded.first_name,
          surname = excluded.surname,
          date_of_birth = excluded.date_of_birth,
          next_of_kin_name = excluded.next_of_kin_name,
          next_of_kin_relationship = excluded.next_of_kin_relationship,
          next_of_kin_telephone = excluded.next_of_kin_telephone,
          next_of_kin_email = excluded.next_of_kin_email,
          ward_id = excluded.ward_id,
          room_number = excluded.room_number,
          observation_level = excluded.observation_level,
          latest_observation_place = excluded.latest_observation_place,
          latest_observation_time = excluded.latest_observation_time,
          latest_observed_by = excluded.latest_observed_by,
          latest_presentation = excluded.latest_presentation,
          on_off_ward = excluded.on_off_ward,
          seclusion = excluded.seclusion,
          long_term_seclusion = excluded.long_term_seclusion,
          allergies = excluded.allergies,
          adverse_drug_reactions = excluded.adverse_drug_reactions,
          enhanced_observation = excluded.enhanced_observation,
          teso_history = excluded.teso_history,
          patient_forms = excluded.patient_forms,
          patient_voice_profile = excluded.patient_voice_profile,
          patient_voice_check_ins = excluded.patient_voice_check_ins,
          family_sharing = excluded.family_sharing,
          family_contributions = excluded.family_contributions,
          archived = excluded.archived,
          updated_at = now()
        returning
          id,
          patient_number as "patientNumber",
          hospital_number as "hospitalNumber",
          first_name as "firstName",
          surname,
          coalesce(date_of_birth::text, '') as "dateOfBirth",
          next_of_kin_name as "nextOfKinName",
          next_of_kin_relationship as "nextOfKinRelationship",
          next_of_kin_telephone as "nextOfKinTelephone",
          next_of_kin_email as "nextOfKinEmail",
          ward_id as "wardId",
          room_number as "roomNumber",
          observation_level as "observationLevel",
          latest_observation_place as "latestObservationPlace",
          latest_observation_time as "latestObservationTime",
          latest_observed_by as "latestObservedBy",
          latest_presentation as "latestPresentation",
          on_off_ward as "onOffWard",
          seclusion,
          long_term_seclusion as "longTermSeclusion",
          allergies,
          adverse_drug_reactions as "adverseDrugReactions",
          enhanced_observation as "enhancedObservation",
          teso_history as "tesoHistory",
          patient_forms as "patientForms",
          patient_voice_profile as "patientVoiceProfile",
          patient_voice_check_ins as "patientVoiceCheckIns",
          family_sharing as "familySharing",
          family_contributions as "familyContributions",
          archived
      `,
      [
        patient.id,
        patient.organisationId,
        patient.patientNumber,
        patient.hospitalNumber,
        patient.firstName,
        patient.surname,
        patient.dateOfBirth,
        patient.nextOfKinName,
        patient.nextOfKinRelationship,
        patient.nextOfKinTelephone,
        patient.nextOfKinEmail,
        patient.wardId,
        patient.roomNumber,
        patient.observationLevel,
        patient.latestObservationPlace,
        patient.latestObservationTime,
        patient.latestObservedBy,
        patient.latestPresentation,
        patient.onOffWard,
        patient.seclusion,
        patient.longTermSeclusion,
        patient.archived,
        patient.allergies,
        patient.adverseDrugReactions,
        JSON.stringify(patient.enhancedObservation ?? null),
        JSON.stringify(patient.tesoHistory ?? []),
        JSON.stringify(patient.patientForms ?? []),
        JSON.stringify(patient.patientVoiceProfile ?? null),
        JSON.stringify(patient.patientVoiceCheckIns ?? []),
        JSON.stringify(patient.familySharing ?? null),
        JSON.stringify(patient.familyContributions ?? [])
      ]
    );

    await recordPatientAuditEvents({
      organisationId,
      requestBody: request.body,
      patient,
      existingPatient
    });
    response.status(201).json({ patient: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

function createPatientId(hospitalNumber: string, firstName: string, surname: string) {
  const slug = `${hospitalNumber}-${firstName}-${surname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `patient-${slug || "record"}-${uniqueSuffix}`;
}

function readPatientId(request: AuthenticatedRequest, response: Response) {
  const value = request.params.id;
  if (typeof value !== "string" || !value.trim()) {
    response.status(400).json({ error: "A valid patient is required" });
    return undefined;
  }
  return value;
}

async function loadPatient(organisationId: string, patientId: string) {
  const result = await pool.query(
    `select id, patient_number as "patientNumber", hospital_number as "hospitalNumber",
       first_name as "firstName", surname, coalesce(date_of_birth::text, '') as "dateOfBirth",
       next_of_kin_name as "nextOfKinName", next_of_kin_relationship as "nextOfKinRelationship",
       next_of_kin_telephone as "nextOfKinTelephone", next_of_kin_email as "nextOfKinEmail",
       ward_id as "wardId", room_number as "roomNumber",
       observation_level as "observationLevel", latest_observation_place as "latestObservationPlace",
       latest_observation_time as "latestObservationTime", latest_observed_by as "latestObservedBy",
       latest_presentation as "latestPresentation", on_off_ward as "onOffWard", seclusion,
       long_term_seclusion as "longTermSeclusion", allergies,
       adverse_drug_reactions as "adverseDrugReactions", enhanced_observation as "enhancedObservation",
       teso_history as "tesoHistory", patient_forms as "patientForms",
       patient_voice_profile as "patientVoiceProfile", patient_voice_check_ins as "patientVoiceCheckIns",
       family_sharing as "familySharing", family_contributions as "familyContributions", archived
     from patients where organisation_id = $1 and id = $2`,
    [organisationId, patientId]
  );
  return result.rows[0];
}

async function recordMovementAudit(
  request: AuthenticatedRequest,
  organisationId: string,
  patientId: string,
  eventType: string,
  details: Record<string, unknown>
) {
  const actor = request.auth?.staff;
  await recordAuditEvent({
    organisationId,
    actorStaffId: actor?.id,
    actorStaffCode: actor?.staffCode,
    eventType,
    entityType: "patient",
    entityId: patientId,
    details
  });
}

async function recordPatientAuditEvents({
  organisationId,
  requestBody,
  patient,
  existingPatient
}: {
  organisationId: string;
  requestBody: unknown;
  patient: z.infer<typeof patientSchema> & { id: string; organisationId: string; latestObservationTime: string };
  existingPatient?: {
    observationLevel?: string;
    allergies?: string;
    adverseDrugReactions?: string;
    enhancedObservation?: unknown;
    tesoHistory?: unknown[];
    patientForms?: unknown[];
    patientVoiceProfile?: unknown;
    patientVoiceCheckIns?: unknown[];
    familySharing?: unknown;
    familyContributions?: unknown[];
  };
}) {
  const actor = auditActorFromBody(requestBody);
  const baseEvent = {
    organisationId,
    ...actor,
    entityType: "patient",
    entityId: patient.id
  };

  if (!existingPatient) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.create",
      details: { patientName: `${patient.firstName} ${patient.surname}`, wardId: patient.wardId }
    });
    return;
  }

  if (existingPatient.allergies !== patient.allergies || existingPatient.adverseDrugReactions !== patient.adverseDrugReactions) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.allergy.update",
      details: {
        patientId: patient.id,
        previous: {
          allergies: existingPatient.allergies ?? "",
          adverseDrugReactions: existingPatient.adverseDrugReactions ?? ""
        },
        next: {
          allergies: patient.allergies,
          adverseDrugReactions: patient.adverseDrugReactions
        }
      }
    });
  }

  const hadTeso = Boolean(existingPatient.enhancedObservation) || existingPatient.observationLevel !== "Intermittent";
  const hasTeso = Boolean(patient.enhancedObservation) || patient.observationLevel !== "Intermittent";

  if (!hadTeso && hasTeso) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.teso.start",
      details: {
        observationLevel: patient.observationLevel,
        enhancedObservation: patient.enhancedObservation,
        activeEpisode: patient.tesoHistory?.find((episode) => !episode.endedAt) ?? patient.tesoHistory?.[0] ?? null
      }
    });
    return;
  }

  if (hadTeso && !hasTeso) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.teso.end",
      details: {
        endedEpisode: patient.tesoHistory?.find((episode) => episode.endedAt) ?? patient.tesoHistory?.[0] ?? null
      }
    });
    return;
  }

  if (JSON.stringify(existingPatient.enhancedObservation ?? null) !== JSON.stringify(patient.enhancedObservation ?? null)) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.teso.update",
      details: {
        observationLevel: patient.observationLevel,
        previous: existingPatient.enhancedObservation ?? null,
        next: patient.enhancedObservation ?? null,
        activeEpisode: patient.tesoHistory?.find((episode) => !episode.endedAt) ?? null
      }
    });
  }

  if (JSON.stringify(existingPatient.patientForms ?? []) !== JSON.stringify(patient.patientForms ?? [])) {
    const newestForm = patient.patientForms?.[0] ?? null;
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.form.update",
      details: {
        patientId: patient.id,
        formTitle: newestForm?.title ?? "Patient form",
        status: newestForm?.status ?? "Updated",
        completedBy: newestForm?.completedBy ?? null
      }
    });
  }

  if (
    JSON.stringify(existingPatient.patientVoiceProfile ?? null) !==
      JSON.stringify(patient.patientVoiceProfile ?? null) ||
    JSON.stringify(existingPatient.patientVoiceCheckIns ?? []) !==
      JSON.stringify(patient.patientVoiceCheckIns ?? [])
  ) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.voice.update",
      details: {
        patientId: patient.id,
        checkInCount: patient.patientVoiceCheckIns?.length ?? 0,
        profileUpdatedAt: patient.patientVoiceProfile?.updatedAt ?? null
      }
    });
  }

  if (
    JSON.stringify(existingPatient.familySharing ?? null) !==
      JSON.stringify(patient.familySharing ?? null) ||
    JSON.stringify(existingPatient.familyContributions ?? []) !==
      JSON.stringify(patient.familyContributions ?? [])
  ) {
    await recordAuditEvent({
      ...baseEvent,
      eventType: "patient.family_sharing.update",
      details: {
        patientId: patient.id,
        consented: patient.familySharing?.patientConsented ?? false,
        contactCount: Array.isArray(patient.familySharing?.contacts)
          ? patient.familySharing.contacts.length
          : 0,
        contributionCount: patient.familyContributions?.length ?? 0,
        awaitingReviewCount:
          patient.familyContributions?.filter(
            (entry) => entry.reviewStatus === "Awaiting staff review"
          ).length ?? 0,
        reviewedContributionCount:
          patient.familyContributions?.filter((entry) => entry.reviewStatus === "Reviewed").length ??
          0
      }
    });
  }
}

export { router as patientRouter };
