import { seedData } from "../data/seedData";
import type {
  MedicationAdministration,
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
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
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

export async function createObservation(observation: OrganisationScoped<Omit<Observation, "id">>) {
  if (!apiUrl) {
    return {
      ...observation,
      id: `local-${Date.now()}`
    };
  }

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

export async function createStaffMember(staff: StaffMember) {
  return request<{ staff: StaffMember }>("/api/staff", {
    method: "POST",
    body: JSON.stringify(staff)
  });
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

export async function createSite(site: OrganisationScoped<Site>) {
  return request<Site>("/api/config/sites", {
    method: "POST",
    body: JSON.stringify(site)
  });
}

export async function loadSites() {
  return request<{ sites: Site[] }>("/api/config/sites");
}

export async function createWard(ward: Ward) {
  return request<Ward>("/api/config/wards", {
    method: "POST",
    body: JSON.stringify(ward)
  });
}

export async function loadWards() {
  return request<{ wards: Ward[] }>("/api/config/wards");
}

function withOrganisationId(path: string, organisationId?: string) {
  return organisationId ? `${path}?organisationId=${encodeURIComponent(organisationId)}` : path;
}
