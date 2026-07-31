import type { StaffMember } from "../types/domain";

export function normaliseStaffRole(role: StaffMember["role"] | string | undefined): StaffMember["role"] {
  const normalisedRole = role?.toLowerCase();

  if (
    normalisedRole === "nurse" ||
    normalisedRole === "hcf" ||
    normalisedRole === "ot" ||
    normalisedRole === "security" ||
    normalisedRole === "manager" ||
    normalisedRole === "doctor" ||
    normalisedRole === "super_admin"
  ) {
    return normalisedRole;
  }

  return "nurse";
}

export function hasStaffRole(staff: StaffMember | undefined, role: StaffMember["role"]) {
  if (!staff) return false;
  return normaliseStaffRole(staff?.role) === role;
}

export function hasAdminAccess(staff: StaffMember | undefined) {
  if (!staff) return false;
  return normaliseStaffRole(staff?.role) === "super_admin";
}
