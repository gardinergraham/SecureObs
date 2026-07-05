import { seedData } from "../data/seedData";
import { expireAuthSession, getAuthSession, storeAuthSession } from "./authSession";
import { configureSyncQueue, enqueueFailedRequest, flushSyncQueue, QueuedSyncError } from "./syncQueue";
import type {
  AuditEvent,
  AuthSession,
  FoodFluidEntry,
  MedicationAdministration,
  MissedObservation,
  MedicationPrescription,
  News2Reading,
  Observation,
  OrganisationSettings,
  Patient,
  PatientCarePlan,
  PatientNote,
  RotaAssignment,
  SafetyIncident,
  SecurityArea,
  SecurityCheck,
  ShiftHandover,
  Site,
  StaffShiftAssignment,
  StaffMember,
  Ward
} from "../types/domain";

const defaultApiUrl = "https://adequate-energy-production.up.railway.app";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;

configureSyncQueue(request);

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }

  const session = await getAuthSession();
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    if (response.status === 401) {
      await expireAuthSession();
    }
    const message = await readErrorMessage(response);
    throw new ApiRequestError(message || `API request failed: ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error;
  } catch {
    return "";
  }
}

export async function loadBootstrapData() {
  if (!apiUrl) {
    return seedData;
  }

  return request<typeof seedData>("/bootstrap");
}

export type OrganisationScoped<T> = T & {
  organisationId?: string;
};

type ActorScoped = {
  actorStaffId?: string;
  actorStaffCode?: string;
};

export async function createObservation(observation: OrganisationScoped<Omit<Observation, "id"> & ActorScoped>) {
  if (!apiUrl) {
    return {
      ...observation,
      id: `local-${Date.now()}`
    };
  }

  const localObservation = {
    ...observation,
    id: `local-${Date.now()}`
  };
  const path = "/api/observations";
  const init = {
    method: "POST",
    body: JSON.stringify(localObservation)
  };

  try {
    const savedObservation = await request<Observation>(path, init);
    await flushSyncQueue();
    return savedObservation;
  } catch (error) {
    if (!isRetryableRequestError(error)) {
      throw error;
    }
    await enqueueFailedRequest("observation", path, init, error);
    return localObservation;
  }
}

export async function saveQueuedRequest<T>(label: string, path: string, init?: RequestInit) {
  try {
    const result = await request<T>(path, init);
    await flushSyncQueue();
    return result;
  } catch (error) {
    if (!isRetryableRequestError(error)) {
      throw error;
    }
    await enqueueFailedRequest(label, path, init, error);
    throw new QueuedSyncError(`${label} queued for sync`);
  }
}

function isRetryableRequestError(error: unknown) {
  return !(error instanceof ApiRequestError) || error.status >= 500;
}

export async function createObservationDirect(observation: OrganisationScoped<Omit<Observation, "id"> & ActorScoped>) {
  return request<Observation>("/api/observations", {
    method: "POST",
    body: JSON.stringify(observation)
  });
}

export async function lookupStaffByCode(staffCode: string, organisationId?: string) {
  const result = await request<{ staff: StaffMember; session?: AuthSession }>("/api/staff/lookup", {
    method: "POST",
    body: JSON.stringify({ staffCode, organisationId })
  });
  await storeAuthSession(result.session);
  return { staff: result.staff };
}

export async function loginBankStaffByPin(staffCode: string, loginPin: string, organisationId: string) {
  const result = await request<{ staff: StaffMember; session?: AuthSession }>("/api/staff/bank-pin-login", {
    method: "POST",
    body: JSON.stringify({ staffCode, loginPin, organisationId })
  });
  await storeAuthSession(result.session);
  return { staff: result.staff };
}

export async function loginStaffByPin(staffCode: string, loginPin: string, organisationId: string) {
  const result = await request<{ staff: StaffMember; session?: AuthSession }>("/api/staff/pin-login", {
    method: "POST",
    body: JSON.stringify({ staffCode, loginPin, organisationId })
  });
  await storeAuthSession(result.session);
  return { staff: result.staff };
}

export async function changeStaffPin(currentPin: string, newPin: string) {
  const result = await request<{ staff: StaffMember; session?: AuthSession }>("/api/staff/change-pin", {
    method: "POST",
    body: JSON.stringify({ currentPin, newPin })
  });
  await storeAuthSession(result.session);
  return { staff: result.staff };
}

export async function resetStaffPin(staffId: string) {
  return request<{ staff: StaffMember }>("/api/staff/reset-pin", {
    method: "POST",
    body: JSON.stringify({ staffId })
  });
}

export async function unlockStaffAccess(lockedStaffCode: string, nurseInChargeStaffCode: string, organisationId: string) {
  return request<{ ok: boolean; unlocked: boolean; message: string }>("/api/staff/unlock-access", {
    method: "POST",
    body: JSON.stringify({ lockedStaffCode, nurseInChargeStaffCode, organisationId })
  });
}

export async function loadCurrentStaffSession() {
  const session = await getAuthSession();
  if (!session) {
    return undefined;
  }

  const result = await request<{ staff: StaffMember }>("/api/staff/session");
  return result.staff;
}

export async function createStaffMember(staff: StaffMember & ActorScoped) {
  return saveQueuedRequest<{ staff: StaffMember }>("staff member", "/api/staff", {
    method: "POST",
    body: JSON.stringify(staff)
  });
}

export async function loadStaff(organisationId?: string) {
  return request<{ staff: StaffMember[] }>(withOrganisationId("/api/staff", organisationId));
}

export async function loadPatients(organisationId?: string) {
  return request<{ patients: Patient[] }>(withOrganisationId("/api/patients", organisationId));
}

export async function savePatient(patient: OrganisationScoped<Patient> & ActorScoped) {
  return saveQueuedRequest<{ patient: Patient }>("patient", "/api/patients", {
    method: "POST",
    body: JSON.stringify(patient)
  });
}

export async function loadPatientNotes(organisationId?: string, wardId?: string) {
  return request<{ patientNotes: PatientNote[] }>(
    withOptionalQuery(withOrganisationId("/api/patient-notes", organisationId), "wardId", wardId)
  );
}

export async function createPatientNote(note: OrganisationScoped<PatientNote> & ActorScoped) {
  return saveQueuedRequest<PatientNote>("patient note", "/api/patient-notes", {
    method: "POST",
    body: JSON.stringify(note)
  });
}

export async function loadPatientCarePlans(organisationId?: string, wardId?: string) {
  return request<{ patientCarePlans: PatientCarePlan[] }>(
    withOptionalQuery(withOrganisationId("/api/patient-care-plans", organisationId), "wardId", wardId)
  );
}

export async function createPatientCarePlan(plan: OrganisationScoped<PatientCarePlan> & ActorScoped) {
  return saveQueuedRequest<PatientCarePlan>("patient care plan", "/api/patient-care-plans", {
    method: "POST",
    body: JSON.stringify(plan)
  });
}

export async function loadSafetyIncidents(organisationId?: string, wardId?: string) {
  return request<{ safetyIncidents: SafetyIncident[] }>(
    withOptionalQuery(withOrganisationId("/api/safety-incidents", organisationId), "wardId", wardId)
  );
}

export async function saveSafetyIncident(incident: OrganisationScoped<SafetyIncident> & ActorScoped) {
  return saveQueuedRequest<SafetyIncident>("safety incident", "/api/safety-incidents", {
    method: "POST",
    body: JSON.stringify(incident)
  });
}

export async function loadShiftHandovers(organisationId?: string, wardId?: string) {
  return request<{ shiftHandovers: ShiftHandover[] }>(
    withOptionalQuery(withOrganisationId("/api/shift-handovers", organisationId), "wardId", wardId)
  );
}

export async function createShiftHandover(handover: OrganisationScoped<ShiftHandover> & ActorScoped) {
  return saveQueuedRequest<ShiftHandover>("shift handover", "/api/shift-handovers", {
    method: "POST",
    body: JSON.stringify(handover)
  });
}

export async function createSecurityCheck(check: OrganisationScoped<SecurityCheck>) {
  return saveQueuedRequest<SecurityCheck>("security check", "/api/security-checks", {
    method: "POST",
    body: JSON.stringify(check)
  });
}

export async function saveSecurityArea(area: OrganisationScoped<SecurityArea> & ActorScoped) {
  return saveQueuedRequest<{ securityArea: SecurityArea }>("security area", "/api/config/security-areas", {
    method: "POST",
    body: JSON.stringify(area)
  });
}

export async function deleteSecurityArea(id: string, organisationId?: string) {
  return saveQueuedRequest<{ deletedId: string }>(
    "security area delete",
    withOrganisationId(`/api/config/security-areas/${encodeURIComponent(id)}`, organisationId),
    { method: "DELETE" }
  );
}

export async function loadOrganisationSettings(organisationId?: string) {
  return request<{ settings: OrganisationSettings }>(withOrganisationId("/api/config/organisation-settings", organisationId));
}

export async function saveOrganisationSettings(settings: OrganisationScoped<OrganisationSettings> & ActorScoped) {
  return saveQueuedRequest<{ settings: OrganisationSettings }>("organisation settings", "/api/config/organisation-settings", {
    method: "POST",
    body: JSON.stringify(settings)
  });
}

export async function loadSecurityAreas(organisationId?: string, wardId?: string) {
  return request<{ securityAreas: SecurityArea[] }>(
    withOptionalQuery(withOrganisationId("/api/config/security-areas", organisationId), "wardId", wardId)
  );
}

export async function loadSecurityChecks(organisationId?: string) {
  return request<{ securityChecks: SecurityCheck[] }>(withOrganisationId("/api/security-checks", organisationId));
}

export async function createNews2Reading(reading: OrganisationScoped<News2Reading>) {
  return saveQueuedRequest<News2Reading>("NEWS2 reading", "/api/news2-readings", {
    method: "POST",
    body: JSON.stringify(reading)
  });
}

export async function createFoodFluidEntry(entry: OrganisationScoped<FoodFluidEntry> & ActorScoped) {
  return saveQueuedRequest<FoodFluidEntry>("food and fluid entry", "/api/food-fluid-entries", {
    method: "POST",
    body: JSON.stringify(entry)
  });
}

export async function saveRotaAssignment(assignment: OrganisationScoped<RotaAssignment>) {
  return saveQueuedRequest<RotaAssignment>("rota assignment", "/api/rota-assignments", {
    method: "POST",
    body: JSON.stringify(assignment)
  });
}

export async function deleteRotaAssignment(id: string, organisationId?: string) {
  const path = withOrganisationId(`/api/rota-assignments/${encodeURIComponent(id)}`, organisationId);
  return saveQueuedRequest<void>("rota assignment delete", path, { method: "DELETE" });
}

export async function loadRotaAssignments(organisationId?: string, wardId?: string) {
  return request<{ rotaAssignments: RotaAssignment[] }>(
    withOptionalQuery(withOrganisationId("/api/rota-assignments", organisationId), "wardId", wardId)
  );
}

export async function saveStaffShiftAssignment(assignment: OrganisationScoped<StaffShiftAssignment>) {
  return saveQueuedRequest<StaffShiftAssignment>("staff shift assignment", "/api/staff-shift-assignments", {
    method: "POST",
    body: JSON.stringify(assignment)
  });
}

export async function deleteStaffShiftAssignment(id: string, organisationId?: string) {
  const path = withOrganisationId(`/api/staff-shift-assignments/${encodeURIComponent(id)}`, organisationId);
  return saveQueuedRequest<void>("staff shift assignment delete", path, { method: "DELETE" });
}

export async function loadStaffShiftAssignments(organisationId?: string, wardId?: string, date?: string) {
  const withWard = withOptionalQuery(withOrganisationId("/api/staff-shift-assignments", organisationId), "wardId", wardId);
  return request<{ staffShiftAssignments: StaffShiftAssignment[] }>(
    withOptionalQuery(withWard, "date", date)
  );
}

export async function loadAuditEvents({
  organisationId,
  search,
  eventType,
  outcome,
  limit = 150
}: {
  organisationId?: string;
  search?: string;
  eventType?: string;
  outcome?: string;
  limit?: number;
}) {
  let path = withOrganisationId("/api/audit-events", organisationId);
  path = withOptionalQuery(path, "search", search?.trim());
  path = withOptionalQuery(path, "eventType", eventType);
  path = withOptionalQuery(path, "outcome", outcome);
  path = withOptionalQuery(path, "limit", String(limit));
  return request<{ auditEvents: AuditEvent[] }>(path);
}

export async function loadNews2Readings(organisationId?: string) {
  return request<{ news2Readings: News2Reading[] }>(withOrganisationId("/api/news2-readings", organisationId));
}

export async function loadFoodFluidEntries(organisationId?: string) {
  return request<{ foodFluidEntries: FoodFluidEntry[] }>(
    withOrganisationId("/api/food-fluid-entries", organisationId)
  );
}

export async function createMedicationPrescription(prescription: OrganisationScoped<MedicationPrescription> & ActorScoped) {
  return saveQueuedRequest<MedicationPrescription>("medication prescription", "/api/medication-prescriptions", {
    method: "POST",
    body: JSON.stringify(prescription)
  });
}

export async function loadMedicationPrescriptions(organisationId?: string) {
  return request<{ medicationPrescriptions: MedicationPrescription[] }>(
    withOrganisationId("/api/medication-prescriptions", organisationId)
  );
}

export async function createMedicationAdministration(administration: OrganisationScoped<MedicationAdministration> & ActorScoped) {
  return saveQueuedRequest<MedicationAdministration>("medication administration", "/api/medication-administrations", {
    method: "POST",
    body: JSON.stringify(administration)
  });
}

export async function loadMedicationAdministrations(organisationId?: string) {
  return request<{ medicationAdministrations: MedicationAdministration[] }>(
    withOrganisationId("/api/medication-administrations", organisationId)
  );
}

export async function updateMedicationPrescription(prescription: OrganisationScoped<MedicationPrescription> & ActorScoped) {
  return createMedicationPrescription(prescription);
}

export async function loadObservations(organisationId?: string) {
  return request<{ observations: Observation[] }>(withOrganisationId("/api/observations", organisationId));
}

export async function createMissedObservation(
  missedObservation: OrganisationScoped<MissedObservation & { actorStaffId?: string; actorStaffCode?: string }>
) {
  return saveQueuedRequest<MissedObservation>("missed observation", "/api/missed-observations", {
    method: "POST",
    body: JSON.stringify(missedObservation)
  });
}

export async function loadMissedObservations(organisationId?: string, wardId?: string) {
  const path = withOrganisationId("/api/missed-observations", organisationId);
  const separator = path.includes("?") ? "&" : "?";
  return request<{ missedObservations: MissedObservation[] }>(
    wardId ? `${path}${separator}wardId=${encodeURIComponent(wardId)}` : path
  );
}

export async function createSite(site: OrganisationScoped<Site>) {
  return saveQueuedRequest<Site>("site", "/api/config/sites", {
    method: "POST",
    body: JSON.stringify(site)
  });
}

export async function loadSites(organisationId?: string) {
  return request<{ sites: Site[] }>(withOrganisationId("/api/config/sites", organisationId));
}

export async function createWard(ward: OrganisationScoped<Ward>) {
  return saveQueuedRequest<Ward>("ward", "/api/config/wards", {
    method: "POST",
    body: JSON.stringify(ward)
  });
}

export async function loadWards(organisationId?: string) {
  return request<{ wards: Ward[] }>(withOrganisationId("/api/config/wards", organisationId));
}

function withOrganisationId(path: string, organisationId?: string) {
  return organisationId ? `${path}?organisationId=${encodeURIComponent(organisationId)}` : path;
}

function withOptionalQuery(path: string, key: string, value?: string) {
  if (!value) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}
