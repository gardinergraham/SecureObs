import type { Ward, StaffMember } from "../types/domain";

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

// Keep the identity record unchanged; screens receive a view for their ward.
export function staffForWard(staff: StaffMember, wardId: string): StaffMember {
  if (hasAdminAccess(staff)) return staff;
  const role = wardId && staff.allowedWardIds.includes(wardId)
    ? staff.wardRoles?.[wardId] ?? normaliseStaffRole(staff.role)
    : "nurse";
  return role === staff.role ? staff : { ...staff, role };
}

export function homeCareManagerAccess(staff: StaffMember, wards: Ward[]): StaffMember {
  if (hasAdminAccess(staff)) return staff;
  const homes = wards.filter(w => w.serviceType === "Home care");
  const managedSites = new Set(homes.filter(w => staff.allowedWardIds.includes(w.id) &&
    (staff.wardRoles?.[w.id] ?? staff.role) === "manager").map(w => w.siteId));
  if (!managedSites.size) return staff;
  const managedHomes = homes.filter(w => managedSites.has(w.siteId));
  return {...staff, allowedWardIds: [...new Set([...staff.allowedWardIds,...managedHomes.map(w=>w.id)])],
    allowedSiteIds: [...new Set([...staff.allowedSiteIds,...managedSites])],
    wardRoles: {...staff.wardRoles,...Object.fromEntries(managedHomes.map(w=>[w.id,"manager" as const]))}};
}
