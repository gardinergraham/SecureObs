import type { PatientIdentificationProfile } from "../types/domain";

export type PatientTagType = "room" | "personal";
export type ParsedPatientTag = { type: PatientTagType; token: string };

export function createPatientTagToken() {
  const random = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}${random}`.slice(0, 22).toUpperCase();
}

export function buildPatientTagPayload(type: PatientTagType, token: string) {
  if (!/^[a-z0-9]{12,32}$/i.test(token)) {
    throw new Error("Save or regenerate this patient tag before writing it.");
  }
  return `SECUREOBS:V1:${type.toUpperCase()}:${token.toUpperCase()}`;
}

export function parsePatientTagPayload(payload: string): ParsedPatientTag | null {
  const match = payload.trim().match(/^secureobs:v1:(room|personal):([a-z0-9]{12,32})$/i);
  const type = match?.[1];
  const token = match?.[2];
  return type && token ? { type: type.toLowerCase() as PatientTagType, token: token.toUpperCase() } : null;
}

export function defaultIdentificationProfile(): PatientIdentificationProfile {
  return {
    showPhoto: true,
    showDateOfBirth: true,
    showHospitalNumber: true,
    showWardAndRoom: true,
    showAllergies: false,
    consentStatus: "not_recorded"
  };
}
