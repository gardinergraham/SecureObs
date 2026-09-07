import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StaffMember } from "../types/domain";

export type StaffDefaults = { siteId: string; wardId: string };

function storageKey(staff: StaffMember) {
  return `secureobs.staffDefaults.v1:${encodeURIComponent(staff.organisationId ?? "default")}:${encodeURIComponent(staff.id)}`;
}

export async function loadStaffDefaults(staff: StaffMember): Promise<StaffDefaults | null> {
  const raw = await AsyncStorage.getItem(storageKey(staff));
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("siteId" in value) || !("wardId" in value)
    || typeof value.siteId !== "string" || typeof value.wardId !== "string"
    || !value.siteId || !value.wardId) throw new Error("Invalid saved defaults");
  return { siteId: value.siteId, wardId: value.wardId };
}

export async function saveStaffDefaults(staff: StaffMember, defaults: StaffDefaults | null) {
  if (defaults) await AsyncStorage.setItem(storageKey(staff), JSON.stringify(defaults));
  else await AsyncStorage.removeItem(storageKey(staff));
}
