import type { StaffMember, Ward } from "../types/domain";

export function assignStaffWardRole(staff: StaffMember, ward: Ward, role: "manager" | "nurse"): StaffMember {
  if (!ward.organisationId || staff.organisationId !== ward.organisationId || staff.role === "super_admin") {
    throw new Error("Choose a staff member from this company.");
  }
  return {
    ...staff,
    wardId: staff.wardId || ward.id,
    allowedSiteIds: Array.from(new Set([...staff.allowedSiteIds, ward.siteId])),
    allowedWardIds: Array.from(new Set([...staff.allowedWardIds, ward.id])),
    wardRoles: {
      ...Object.fromEntries(staff.allowedWardIds.map(id => [id, staff.wardRoles?.[id] ?? staff.role])),
      [ward.id]: role
    } as NonNullable<StaffMember["wardRoles"]>
  };
}
