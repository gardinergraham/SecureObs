import { seedData } from "../data/seedData";
import type { Observation, StaffMember } from "../types/domain";

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

export async function createObservation(observation: Omit<Observation, "id">) {
  if (!apiUrl) {
    return {
      ...observation,
      id: `local-${Date.now()}`
    };
  }

  return request<Observation>("/observations", {
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
