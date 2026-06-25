import { Router } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { requireStaffRole } from "../auth.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();

const patientSchema = z.object({
  id: z.string().min(1).optional(),
  organisationId: optionalOrganisationIdSchema,
  patientNumber: z.number().int().nonnegative(),
  hospitalNumber: z.string().min(1),
  firstName: z.string().min(1),
  surname: z.string().min(1),
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
  enhancedObservation: z.record(z.string(), z.unknown()).optional(),
  tesoHistory: z.array(z.record(z.string(), z.unknown())).default([]),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
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

router.post("/", requireStaffRole(["nurse", "manager", "doctor"]), async (request, response, next) => {
  try {
    const parsed = patientSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Invalid patient", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;

    const patient = {
      ...parsed.data,
      organisationId,
      id: parsed.data.id ?? createPatientId(parsed.data.hospitalNumber, parsed.data.firstName, parsed.data.surname),
      latestObservationTime: parsed.data.latestObservationTime ?? new Date().toISOString()
    };
    const existingResult = await pool.query(
      `
        select
          observation_level as "observationLevel",
          allergies,
          adverse_drug_reactions as "adverseDrugReactions",
          enhanced_observation as "enhancedObservation",
          teso_history as "tesoHistory"
        from patients
        where organisation_id = $1 and id = $2
      `,
      [organisationId, patient.id]
    );
    const existingPatient = existingResult.rows[0] as
      | {
          observationLevel?: string;
          allergies?: string;
          adverseDrugReactions?: string;
          enhancedObservation?: unknown;
          tesoHistory?: unknown[];
        }
      | undefined;

    const result = await pool.query(
      `
        insert into patients (
          id, organisation_id, patient_number, hospital_number, first_name, surname, ward_id, room_number,
          observation_level, latest_observation_place, latest_observation_time, latest_observed_by,
          latest_presentation, on_off_ward, seclusion, long_term_seclusion, archived,
          allergies, adverse_drug_reactions, enhanced_observation, teso_history
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb)
        on conflict (id) do update set
          patient_number = excluded.patient_number,
          hospital_number = excluded.hospital_number,
          first_name = excluded.first_name,
          surname = excluded.surname,
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
          archived = excluded.archived,
          updated_at = now()
        returning
          id,
          patient_number as "patientNumber",
          hospital_number as "hospitalNumber",
          first_name as "firstName",
          surname,
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
          archived
      `,
      [
        patient.id,
        patient.organisationId,
        patient.patientNumber,
        patient.hospitalNumber,
        patient.firstName,
        patient.surname,
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
        JSON.stringify(patient.tesoHistory ?? [])
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

  return `patient-${slug || Date.now()}`;
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
}

export { router as patientRouter };
