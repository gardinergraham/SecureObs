import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";

const router = Router();

const staffLookupSchema = z.object({
  staffCode: z.string().min(1)
});

router.get("/", async (_request, response, next) => {
  try {
    const result = await pool.query(`
      select
        id,
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

    const staff = await findActiveStaffByCode(parsed.data.staffCode);

    if (!staff) {
      response.status(404).json({ error: "Staff member not found" });
      return;
    }

    response.json({ staff });
  } catch (error) {
    next(error);
  }
});

async function findActiveStaffByCode(staffCode: string) {
  const result = await pool.query(
    `
      select
        id,
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
        and active = true
      limit 1
    `,
    [staffCode]
  );

  return result.rows[0] ?? null;
}

export { router as staffRouter };
