export const lateObservationAuditMinutes = 2;
export const missedObservationReasonMinutes = 5;

export function getObservationLateness(dueAt: string | undefined, now = Date.now()) {
  const dueTime = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  const lateMilliseconds = Number.isFinite(dueTime) ? Math.max(0, now - dueTime) : 0;
  return {
    lateMilliseconds,
    lateMinutes: Math.floor(lateMilliseconds / 60000),
    recordLateCompletion: lateMilliseconds >= lateObservationAuditMinutes * 60000,
    reasonRequired: lateMilliseconds >= missedObservationReasonMinutes * 60000
  };
}
