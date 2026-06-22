import { pool } from "./db/pool.js";

type AuditEventInput = {
  organisationId: string;
  actorStaffId?: string | null;
  actorStaffCode?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  outcome?: "success" | "failure";
  details?: Record<string, unknown>;
};

export async function recordAuditEvent({
  organisationId,
  actorStaffId,
  actorStaffCode,
  eventType,
  entityType,
  entityId,
  outcome = "success",
  details = {}
}: AuditEventInput) {
  await pool.query(
    `
      insert into audit_events (
        id, organisation_id, actor_staff_id, actor_staff_code, event_type, entity_type,
        entity_id, outcome, details
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    `,
    [
      `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organisationId,
      actorStaffId ?? null,
      actorStaffCode ?? null,
      eventType,
      entityType,
      entityId ?? null,
      outcome,
      JSON.stringify(details)
    ]
  );
}

export function auditActorFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {};
  }

  const record = body as Record<string, unknown>;
  return {
    actorStaffId: typeof record.actorStaffId === "string" ? record.actorStaffId : null,
    actorStaffCode: typeof record.actorStaffCode === "string" ? record.actorStaffCode : null
  };
}
