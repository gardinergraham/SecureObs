import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";

const router = Router();

const staffLookupSchema = z.object({
  staffCode: z.string().min(1),
  organisationId: z.string().uuid().optional()
});

router.get("/", async (_request, response, next) => {
  try {
    const result = await pool.query(`
      select
        id,
        organisation_id as "organisationId",
        key_number as "keyNumber",
        staff_code as "staffCode",
        display_name as "name",
        role,
        designation,
        can_prescribe as "canPrescribe",
        ward_id as "wardId",
        allowed_site_ids as "allowedSiteIds",
        allowed_ward_ids as "allowedWardIds",
        active
      from staff_members
      order by display_name asc
    `);

    response.json({ staff: result.rows });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: "Staff code matches more than one organisation" });
      return;
    }

    next(error);
  }
});

router.get("/by-code/:staffCode", async (request, response, next) => {
  try {
    const staff = await findActiveStaffByCode(request.params.staffCode);

    if (!staff) {
      response.status(404).json({ error: "Staff member not found" });
      return;
    }

    response.json({ staff });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: "Staff code matches more than one organisation" });
      return;
    }

    next(error);
  }
});

router.post("/lookup", async (request, response, next) => {
  try {
    const parsed = staffLookupSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "staffCode is required" });
      return;
    }

    const staff = await findActiveStaffByCode(parsed.data.staffCode, parsed.data.organisationId);

    if (!staff) {
      response.status(404).json({ error: "Staff member not found" });
      return;
    }

    response.json({ staff });
  } catch (error) {
    next(error);
  }
});

async function findActiveStaffByCode(staffCode: string, organisationId?: string) {
  const result = await pool.query(
    `
      select
        id,
        organisation_id as "organisationId",
        key_number as "keyNumber",
        staff_code as "staffCode",
        display_name as "name",
        role,
        designation,
        can_prescribe as "canPrescribe",
        ward_id as "wardId",
        allowed_site_ids as "allowedSiteIds",
        allowed_ward_ids as "allowedWardIds",
        active
      from staff_members
      where lower(staff_code) = lower($1)
        and ($2::uuid is null or organisation_id = $2::uuid)
        and active = true
      order by display_name asc
      limit 2
    `,
    [staffCode, organisationId ?? null]
  );

  if (!organisationId && result.rows.length > 1) {
    throw new StaffLookupAmbiguousError();
  }

  return result.rows[0] ?? null;
}

class StaffLookupAmbiguousError extends Error {
  constructor() {
    super("Staff code matches more than one organisation");
  }
}

export { router as staffRouter };
