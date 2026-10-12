import type { StaffMemberRecord } from "./data/types.js";

const assignments = Symbol("explicit staff assignments");
type EffectiveStaff = StaffMemberRecord & { [assignments]?: StaffMemberRecord };

// Derived site-wide rights must never become permanent ward assignments on save.
export function explicitStaff(staff: StaffMemberRecord): StaffMemberRecord {
  const original = (staff as EffectiveStaff)[assignments];
  if (!original) return staff;
  const { [assignments]: _, ...current } = staff as EffectiveStaff;
  return { ...current, allowedWardIds: original.allowedWardIds, allowedSiteIds: original.allowedSiteIds, wardRoles: original.wardRoles };
}

export function homeCareManagerAccess(staff: StaffMemberRecord, homes: {id:string;siteId:string}[]): StaffMemberRecord {
  const original = explicitStaff(staff);
  if (original.role === "super_admin") return original;
  const managedSites = new Set(homes.filter(h => original.allowedWardIds.includes(h.id) &&
    (original.wardRoles?.[h.id] ?? original.role) === "manager").map(h => h.siteId));
  if (!managedSites.size) return original;
  const managedHomes = homes.filter(h => managedSites.has(h.siteId));
  return { ...original, [assignments]: original,
    allowedWardIds: [...new Set([...original.allowedWardIds, ...managedHomes.map(h=>h.id)])],
    allowedSiteIds: [...new Set([...original.allowedSiteIds, ...managedSites])],
    wardRoles: {...original.wardRoles, ...Object.fromEntries(managedHomes.map(h=>[h.id,"manager" as const]))}
  } as EffectiveStaff;
}
