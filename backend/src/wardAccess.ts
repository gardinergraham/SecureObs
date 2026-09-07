import type { StaffMemberRecord, StaffRole } from "./data/types.js";

export function roleInWard(staff: StaffMemberRecord, wardId: string | undefined): StaffRole | undefined {
  if (staff.role === "super_admin") return "super_admin";
  if (!wardId || !staff.allowedWardIds.includes(wardId)) return undefined;
  return staff.wardRoles?.[wardId] ?? staff.role;
}
