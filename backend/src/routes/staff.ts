import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";

const router = Router();

const staffLookupSchema = z.object({
  staffCode: z.string().min(1),
  organisationId: z.string().uuid().optional()
});

const staffMemberSchema = z.object({
  id: z.string().optional(),
  organisationId: z.string().uuid().optional().default("00000000-0000-0000-0000-000000000001"),
  keyNumber: z.number().int().optional(),
  staffCode: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["nurse", "hcf", "security", "manager", "doctor"]),
  designation: z.string().optional(),
  canPrescribe: z.boolean().default(false),
  employmentType: z.enum(["permanent", "bank"]).default("permanent"),
  accessExpiresAt: z.string().datetime().optional(),
  loginPin: z.string().optional(),
  wardId: z.string().min(1),
  allowedSiteIds: z.array(z.string()).min(1),
  allowedWardIds: z.array(z.string()).min(1),
  active: z.boolean().default(true)
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
        employment_type as "employmentType",
        access_expires_at as "accessExpiresAt",
        login_pin as "loginPin",
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

router.post("/", async (request, response, next) => {
  try {
    const parsed = staffMemberSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Invalid staff member", details: parsed.error.flatten() });
      return;
    }

    const staff = parsed.data;
    const result = await pool.query(
      `
        insert into staff_members (
          organisation_id, key_number, staff_code, display_name, role, designation, can_prescribe,
          employment_type, access_expires_at, login_pin, ward_id, allowed_site_ids, allowed_ward_ids, active
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (organisation_id, staff_code) do update set
          key_number = excluded.key_number,
          display_name = excluded.display_name,
          role = excluded.role,
          designation = excluded.designation,
          can_prescribe = excluded.can_prescribe,
          employment_type = excluded.employment_type,
          access_expires_at = excluded.access_expires_at,
          login_pin = excluded.login_pin,
          ward_id = excluded.ward_id,
          allowed_site_ids = excluded.allowed_site_ids,
          allowed_ward_ids = excluded.allowed_ward_ids,
          active = excluded.active,
          updated_at = now()
        returning
          id,
          organisation_id as "organisationId",
          key_number as "keyNumber",
          staff_code as "staffCode",
          display_name as "name",
          role,
          designation,
          can_prescribe as "canPrescribe",
          employment_type as "employmentType",
          access_expires_at as "accessExpiresAt",
          login_pin as "loginPin",
          ward_id as "wardId",
          allowed_site_ids as "allowedSiteIds",
          allowed_ward_ids as "allowedWardIds",
          active
      `,
      [
        staff.organisationId,
        staff.keyNumber ?? null,
        staff.staffCode,
        staff.name,
        staff.role,
        staff.designation ?? null,
        staff.canPrescribe,
        staff.employmentType,
        staff.accessExpiresAt ?? null,
        staff.loginPin ?? null,
        staff.wardId,
        staff.allowedSiteIds,
        staff.allowedWardIds,
        staff.active
      ]
    );

    response.status(201).json({ staff: result.rows[0] });
  } catch (error) {
    if (isUniqueConflict(error)) {
      response.status(409).json({ error: "A staff member with that STAFFCODE already exists for this organisation" });
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
        employment_type as "employmentType",
        access_expires_at as "accessExpiresAt",
        login_pin as "loginPin",
        ward_id as "wardId",
        allowed_site_ids as "allowedSiteIds",
        allowed_ward_ids as "allowedWardIds",
        active
      from staff_members
      where lower(staff_code) = lower($1)
        and ($2::uuid is null or organisation_id = $2::uuid)
        and active = true
        and (access_expires_at is null or access_expires_at > now())
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

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export { router as staffRouter };
