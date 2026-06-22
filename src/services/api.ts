import { seedData } from "../data/seedData";
import { enqueueFailedSave, flushSyncQueue } from "./syncQueue";
import type {
  MedicationAdministration,
  MissedObservation,
  MedicationPrescription,
  News2Reading,
  Observation,
  Patient,
  SecurityCheck,
  Site,
  StaffMember,
  Ward
} from "../types/domain";

const defaultApiUrl = "https://adequate-energy-production.up.railway.app";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `API request failed: ${response.status}`);
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
  const run = () =>
    request<Observation>("/api/observations", {
      method: "POST",
      body: JSON.stringify(localObservation)
    });

  try {
    const savedObservation = await run();
    await flushSyncQueue();
    return savedObservation;
  } catch (error) {
    enqueueFailedSave("observation", run, error);
    return localObservation;
  }
}

export async function saveQueuedRequest<T>(label: string, path: string, init?: RequestInit) {
  const run = () => request<T>(path, init);

  try {
    const result = await run();
    await flushSyncQueue();
    return result;
  } catch (error) {
    enqueueFailedSave(label, run, error);
    throw error;
  }
}

export async function createObservationDirect(observation: OrganisationScoped<Omit<Observation, "id"> & ActorScoped>) {
  return request<Observation>("/api/observations", {
    method: "POST",
    body: JSON.stringify(observation)
  });
}

export async function lookupStaffByCode(staffCode: string, organisationId?: string) {
  return request<{ staff: StaffMember }>("/api/staff/lookup", {
    method: "POST",
    body: JSON.stringify({ staffCode, organisationId })
  });
}

export async function loginBankStaffByPin(staffCode: string, loginPin: string, organisationId: string) {
  return request<{ staff: StaffMember }>("/api/staff/bank-pin-login", {
    method: "POST",
    body: JSON.stringify({ staffCode, loginPin, organisationId })
  });
}

export async function createStaffMember(staff: StaffMember) {
  return request<{ staff: StaffMember }>("/api/staff", {
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

export async function savePatient(patient: OrganisationScoped<Patient>) {
  return request<{ patient: Patient }>("/api/patients", {
    method: "POST",
    body: JSON.stringify(patient)
  });
}

export async function createSecurityCheck(check: OrganisationScoped<SecurityCheck>) {
  return request<SecurityCheck>("/api/security-checks", {
    method: "POST",
    body: JSON.stringify(check)
  });
}

export async function loadSecurityChecks(organisationId?: string) {
  return request<{ securityChecks: SecurityCheck[] }>(withOrganisationId("/api/security-checks", organisationId));
}

export async function createNews2Reading(reading: OrganisationScoped<News2Reading>) {
  return request<News2Reading>("/api/news2-readings", {
    method: "POST",
    body: JSON.stringify(reading)
  });
}

export async function loadNews2Readings(organisationId?: string) {
  return request<{ news2Readings: News2Reading[] }>(withOrganisationId("/api/news2-readings", organisationId));
}

export async function createMedicationPrescription(prescription: OrganisationScoped<MedicationPrescription>) {
  return request<MedicationPrescription>("/api/medication-prescriptions", {
    method: "POST",
    body: JSON.stringify(prescription)
  });
}

export async function loadMedicationPrescriptions(organisationId?: string) {
  return request<{ medicationPrescriptions: MedicationPrescription[] }>(
    withOrganisationId("/api/medication-prescriptions", organisationId)
  );
}

export async function createMedicationAdministration(administration: OrganisationScoped<MedicationAdministration>) {
  return request<MedicationAdministration>("/api/medication-administrations", {
    method: "POST",
    body: JSON.stringify(administration)
  });
}

export async function loadMedicationAdministrations(organisationId?: string) {
  return request<{ medicationAdministrations: MedicationAdministration[] }>(
    withOrganisationId("/api/medication-administrations", organisationId)
  );
}

export async function updateMedicationPrescription(prescription: OrganisationScoped<MedicationPrescription>) {
  return createMedicationPrescription(prescription);
}

export async function loadObservations(organisationId?: string) {
  return request<{ observations: Observation[] }>(withOrganisationId("/api/observations", organisationId));
}

export async function createMissedObservation(
  missedObservation: OrganisationScoped<MissedObservation & { actorStaffId?: string; actorStaffCode?: string }>
) {
  return request<MissedObservation>("/api/missed-observations", {
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
  return request<Site>("/api/config/sites", {
    method: "POST",
    body: JSON.stringify(site)
  });
}

export async function loadSites(organisationId?: string) {
  return request<{ sites: Site[] }>(withOrganisationId("/api/config/sites", organisationId));
}

export async function createWard(ward: OrganisationScoped<Ward>) {
  return request<Ward>("/api/config/wards", {
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
