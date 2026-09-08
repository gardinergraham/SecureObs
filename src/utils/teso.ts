import type { EnhancedObservationPlan, Patient, TesoEpisode } from "../types/domain";

export function getActiveTesoEpisode(patient: Patient): TesoEpisode | undefined {
  return patient.tesoHistory?.find((episode) => !episode.endedAt);
}

export function hasActiveTeso(patient: Patient): boolean {
  return Boolean(
    patient.enhancedObservation ||
    patient.observationLevel !== "Intermittent" ||
    getActiveTesoEpisode(patient)
  );
}

export function getActiveTesoPlan(patient: Patient): EnhancedObservationPlan | undefined {
  if (patient.enhancedObservation) return patient.enhancedObservation;

  const episode = getActiveTesoEpisode(patient);
  if (!episode) return undefined;

  return {
    staffRatio: episode.staffRatio,
    reasons: episode.reasons,
    otherReason: episode.otherReason,
    startedAt: episode.startedAt,
    authorisedBy: episode.authorisedBy,
    assignedStaffIds: [],
    carePlan: episode.carePlan,
    reviewFrequencyMinutes: episode.reviewFrequencyMinutes,
    nextReviewAt: episode.nextReviewAt
  };
}
