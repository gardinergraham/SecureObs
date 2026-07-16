import { Router } from "express";

import { recordAuditEvent } from "../audit.js";
import { requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { pool } from "../db/pool.js";

const router = Router();
const portalRoles = ["nurse", "manager", "doctor", "super_admin"] as const;

router.get("/bootstrap", requireStaffRole([...portalRoles]), async (request: AuthenticatedRequest, response, next) => {
  try {
    const staff = request.auth?.staff;
    if (!staff) {
      response.status(401).json({ error: "Authenticated staff session required" });
      return;
    }

    const wardIds = staff.allowedWardIds;
    const [wardsResult, patientsResult, notesResult, carePlansResult] = await Promise.all([
      pool.query(
        `select id, name, site_id as "siteId"
         from wards
         where organisation_id = $1 and id = any($2::text[])
         order by name`,
        [staff.organisationId, wardIds]
      ),
      pool.query(
        `select id, patient_number as "patientNumber", hospital_number as "hospitalNumber",
                first_name as "firstName", surname, ward_id as "wardId", room_number as "roomNumber",
                allergies, adverse_drug_reactions as "adverseDrugReactions"
         from patients
         where organisation_id = $1 and ward_id = any($2::text[]) and archived = false
         order by ward_id, room_number, surname`,
        [staff.organisationId, wardIds]
      ),
      pool.query(
        `select id, patient_id as "patientId", ward_id as "wardId", body,
                recorded_by_name as "recordedByName", recorded_by_staff_code as "recordedByStaffCode",
                recorded_at as "recordedAt"
         from patient_notes
         where organisation_id = $1 and ward_id = any($2::text[])
         order by recorded_at desc
         limit 1000`,
        [staff.organisationId, wardIds]
      ),
      pool.query(
        `select id, patient_id as "patientId", ward_id as "wardId", title,
                identified_needs as "identifiedNeeds", risks_and_triggers as "risksAndTriggers",
                goals, interventions, patient_views as "patientViews", review_date as "reviewDate",
                additional_notes as "additionalNotes", created_by_name as "createdByName",
                created_by_staff_code as "createdByStaffCode", created_at as "createdAt"
         from patient_care_plans
         where organisation_id = $1 and ward_id = any($2::text[])
         order by created_at desc
         limit 500`,
        [staff.organisationId, wardIds]
      )
    ]);

    await recordAuditEvent({
      organisationId: staff.organisationId,
      actorStaffId: staff.id,
      actorStaffCode: staff.staffCode,
      eventType: "staff_portal.open",
      entityType: "staff_portal",
      entityId: null,
      details: { wardCount: wardsResult.rowCount }
    });

    response.json({
      staff: { id: staff.id, name: staff.name, staffCode: staff.staffCode, role: staff.role },
      organisationId: staff.organisationId,
      wards: wardsResult.rows,
      patients: patientsResult.rows,
      patientNotes: notesResult.rows,
      patientCarePlans: carePlansResult.rows
    });
  } catch (error) {
    next(error);
  }
});

export { router as staffPortalRouter };
