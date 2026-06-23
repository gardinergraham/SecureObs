import { pool } from "../../db/pool.js";
import {
  DuplicateStaffCodeError,
  StaffLookupAmbiguousError,
  type StaffMemberRecord,
  type StaffRepository
} from "../types.js";

export const postgresStaffRepository: StaffRepository = {
  async list(organisationId) {
    const result = await pool.query(staffSelectSql("where organisation_id = $1 order by display_name asc"), [
      organisationId
    ]);
    return result.rows;
  },

  async upsert(staff) {
    try {
      const result = await pool.query(
        `
          insert into staff_members (
            organisation_id, key_number, staff_code, display_name, role, designation, can_prescribe,
            employment_type, access_starts_at, access_expires_at, login_pin, ward_id, allowed_site_ids,
            allowed_ward_ids, active
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          on conflict (organisation_id, staff_code) do update set
            key_number = excluded.key_number,
            display_name = excluded.display_name,
            role = excluded.role,
            designation = excluded.designation,
            can_prescribe = excluded.can_prescribe,
            employment_type = excluded.employment_type,
            access_starts_at = excluded.access_starts_at,
            access_expires_at = excluded.access_expires_at,
            login_pin = excluded.login_pin,
            ward_id = excluded.ward_id,
            allowed_site_ids = excluded.allowed_site_ids,
            allowed_ward_ids = excluded.allowed_ward_ids,
            active = excluded.active,
            updated_at = now()
          ${staffReturningSql}
        `,
        [
          staff.organisationId,
          staff.keyNumber ?? null,
          staff.staffCode,
          staff.name,
          staff.role.toLowerCase(),
          staff.designation ?? null,
          staff.canPrescribe,
          staff.employmentType,
          staff.accessStartsAt ?? null,
          staff.accessExpiresAt ?? null,
          staff.loginPin ?? null,
          staff.wardId,
          staff.allowedSiteIds,
          staff.allowedWardIds,
          staff.active
        ]
      );

      return result.rows[0];
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new DuplicateStaffCodeError();
      }

      throw error;
    }
  },

  async findActiveByCode(staffCode, organisationId) {
    const result = await pool.query(
      staffSelectSql(`
        where lower(staff_code) = lower($1)
          and ($2::uuid is null or organisation_id = $2::uuid)
          and active = true
          and (access_starts_at is null or access_starts_at <= now())
          and (access_expires_at is null or access_expires_at > now())
        order by display_name asc
        limit 2
      `),
      [staffCode, organisationId ?? null]
    );

    if (!organisationId && result.rows.length > 1) {
      throw new StaffLookupAmbiguousError();
    }

    return result.rows[0] ?? null;
  }
};

function staffSelectSql(suffix: string) {
  return `
    select
      id,
      organisation_id as "organisationId",
      key_number as "keyNumber",
      staff_code as "staffCode",
      display_name as "name",
      lower(role) as role,
      designation,
      can_prescribe as "canPrescribe",
      employment_type as "employmentType",
      access_starts_at as "accessStartsAt",
      access_expires_at as "accessExpiresAt",
      login_pin as "loginPin",
      ward_id as "wardId",
      allowed_site_ids as "allowedSiteIds",
      allowed_ward_ids as "allowedWardIds",
      active
    from staff_members
    ${suffix}
  `;
}

const staffReturningSql = `
  returning
    id,
    organisation_id as "organisationId",
    key_number as "keyNumber",
    staff_code as "staffCode",
    display_name as "name",
    lower(role) as role,
    designation,
    can_prescribe as "canPrescribe",
    employment_type as "employmentType",
    access_starts_at as "accessStartsAt",
    access_expires_at as "accessExpiresAt",
    login_pin as "loginPin",
    ward_id as "wardId",
    allowed_site_ids as "allowedSiteIds",
    allowed_ward_ids as "allowedWardIds",
    active
`;

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
