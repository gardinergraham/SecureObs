import type { StaffMember } from "../types/domain";

export function normaliseStaffRole(role: StaffMember["role"] | string | undefined): StaffMember["role"] {
  const normalisedRole = role?.toLowerCase();

  if (
    normalisedRole === "nurse" ||
    normalisedRole === "hcf" ||
    normalisedRole === "ot" ||
    normalisedRole === "security" ||
    normalisedRole === "manager" ||
    normalisedRole === "doctor"
  ) {
    return normalisedRole;
  }

  return "nurse";
}

export function hasStaffRole(staff: StaffMember | undefined, role: StaffMember["role"]) {
  return normaliseStaffRole(staff?.role) === role;
}
