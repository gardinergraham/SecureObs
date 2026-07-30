import type { PatientLocation, ServiceType } from "../types/domain";

const hospitalObservationLocations: PatientLocation[] = [
  "Side room",
  "Day room",
  "Corridor",
  "Dining room",
  "Bathroom",
  "Laundry",
  "Off ward",
  "LOA"
];

const careHomeObservationLocations: PatientLocation[] = [
  "Bedroom",
  "Lounge",
  "Corridor",
  "Dining room",
  "Bathroom",
  "Garden",
  "Off site",
  "Hospital"
];

export function defaultObservationLocations(serviceType?: ServiceType): PatientLocation[] {
  return [...(serviceType === "Care home" ? careHomeObservationLocations : hospitalObservationLocations)];
}

export function wardObservationLocations(
  serviceType: ServiceType | undefined,
  configuredLocations?: PatientLocation[]
) {
  const locations = (configuredLocations ?? []).map((location) => location.trim()).filter(Boolean);
  return locations.length > 0 ? locations : defaultObservationLocations(serviceType);
}
