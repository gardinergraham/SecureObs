import { seedData } from "../data/seedData";
import type { Observation } from "../types/domain";

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

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
