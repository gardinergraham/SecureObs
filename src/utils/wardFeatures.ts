import type { Ward } from "../types/domain";

export type WardFeatureKey =
  | "assessmentFormsEnabled"
  | "enhancedObservationsEnabled"
  | "foodFluidChartEnabled"
  | "medicationChartEnabled"
  | "news2Enabled"
  | "securityChecksEnabled"
  | "staffRotaEnabled";

export const wardFeatureDefinitions: Array<{ key: WardFeatureKey; label: string }> = [
  { key: "news2Enabled", label: "NEWS2" },
  { key: "enhancedObservationsEnabled", label: "Enhanced observations / TESO" },
  { key: "foodFluidChartEnabled", label: "Food and fluid" },
  { key: "medicationChartEnabled", label: "Medication chart" },
  { key: "assessmentFormsEnabled", label: "Assessment forms" },
  { key: "securityChecksEnabled", label: "Security checks" },
  { key: "staffRotaEnabled", label: "Staff rota" }
];

export function getDisabledWardFeatures(ward?: Ward) {
  if (!ward) return wardFeatureDefinitions;
  return wardFeatureDefinitions.filter((feature) => !ward[feature.key]);
}
