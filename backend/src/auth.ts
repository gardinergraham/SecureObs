import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { recordAuditEvent } from "./audit.js";
import { pool } from "./db/pool.js";
import { roleInWard } from "./wardAccess.js";

import { config } from "./config.js";
import { dataProvider } from "./data/provider.js";
import type { StaffMemberRecord, StaffRole } from "./data/types.js";

type SessionPayload = {
  staffId: string;
  staffCode: string;
  organisationId: string;
  role: StaffRole;
  canPrescribe: boolean;
  allowedSiteIds: string[];
  allowedWardIds: string[];
  issuedAt: number;
  expiresAt: number;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  staffId: string;
  organisationId: string;
};

export type AuthenticatedRequest = Request & {
  auth?: {
    staff: StaffMemberRecord;
    baseStaff?: StaffMemberRecord;
    wardId?: string;
    session: SessionPayload;
  };
};

export function createStaffSession(staff: StaffMemberRecord): AuthSession {
  const issuedAt = Date.now();
  const normalSessionExpiry = issuedAt + config.sessionTtlMinutes * 60 * 1000;
  const temporaryAccessExpiry = staff.employmentType === "bank" && staff.accessExpiresAt
    ? new Date(staff.accessExpiresAt).getTime()
    : Number.POSITIVE_INFINITY;
  const expiresAt = Number.isFinite(temporaryAccessExpiry)
    ? Math.min(normalSessionExpiry, temporaryAccessExpiry)
    : normalSessionExpiry;
  const payload: SessionPayload = {
    staffId: staff.id ?? "",
    staffCode: staff.staffCode,
    organisationId: staff.organisationId,
    role: staff.role,
    canPrescribe: staff.canPrescribe,
    allowedSiteIds: staff.allowedSiteIds,
    allowedWardIds: staff.allowedWardIds,
    issuedAt,
    expiresAt
  };

  return {
    token: signPayload(payload),
    expiresAt: new Date(expiresAt).toISOString(),
    staffId: payload.staffId,
    organisationId: payload.organisationId
  };
}

export async function authenticateRequest(request: AuthenticatedRequest, _response: Response, next: NextFunction) {
  const token = readBearerToken(request);
  if (!token) {
    next();
    return;
  }

  try {
    const session = verifyToken(token);
    const staff = await dataProvider.staff.findActiveById(session.staffId, session.organisationId);
    if (staff) {
      request.auth = { staff, session };
    }
  } catch {
    request.auth = undefined;
  }

  next();
}

export function requireAuthenticated(request: AuthenticatedRequest, response: Response) {
  if (!request.auth) {
    response.status(401).json({ error: "Authenticated staff session required" });
    return undefined;
  }

  return request.auth;
}

export function requireStaffRole(roles: StaffRole[]) {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const auth = requireAuthenticated(request, response);
    if (!auth) return;

    let role: StaffRole | undefined;
    try { role = await applyWardRole(request); } catch (error) { next(error); return; }
    if (!role || !roles.includes(role)) {
      await recordAuditEvent({
        organisationId: auth.staff.organisationId,
        actorStaffId: auth.staff.id,
        actorStaffCode: auth.staff.staffCode,
        eventType: "access.denied",
        entityType: "route",
        entityId: request.path,
        outcome: "failure",
        details: { method: request.method, requiredRoles: roles, actualRole: auth.staff.role }
      });
      response.status(403).json({ error: "Staff role does not have permission for this action" });
      return;
    }

    next();
  };
}

export function requirePrescriber() {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const auth = requireAuthenticated(request, response);
    if (!auth) return;

    let role: StaffRole | undefined;
    try { role = await applyWardRole(request); } catch (error) { next(error); return; }
    if (!role || (!auth.staff.canPrescribe && role !== "doctor")) {
      await recordAuditEvent({
        organisationId: auth.staff.organisationId,
        actorStaffId: auth.staff.id,
        actorStaffCode: auth.staff.staffCode,
        eventType: "access.denied",
        entityType: "route",
        entityId: request.path,
        outcome: "failure",
        details: { method: request.method, requiredPermission: "can_prescribe", actualRole: auth.staff.role }
      });
      response.status(403).json({ error: "Prescribing permission required for this action" });
      return;
    }

    next();
  };
}

export function staffCanAccessOrganisation(request: AuthenticatedRequest, organisationId: string) {
  return !request.auth || request.auth.staff.organisationId === organisationId;
}

function readBearerToken(request: Request) {
  const header = request.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice("bearer ".length).trim();
}

function signPayload(payload: SessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): SessionPayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Malformed session token");
  }

  const expectedSignature = crypto
    .createHmac("sha256", config.sessionSecret)
    .update(encodedPayload)
    .digest("base64url");

  const providedSignature = Buffer.from(signature);
  const validSignature = Buffer.from(expectedSignature);
  if (
    providedSignature.length !== validSignature.length ||
    !crypto.timingSafeEqual(providedSignature, validSignature)
  ) {
    throw new Error("Invalid session token signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
  if (!payload.staffId || !payload.organisationId || payload.expiresAt <= Date.now()) {
    throw new Error("Expired session token");
  }

  return payload;
}

// Resolve the resource's ward before checking a role. The UI header is only a
// fallback for actions such as staff setup that have no single resource ward.
async function applyWardRole(request: AuthenticatedRequest): Promise<StaffRole | undefined> {
  const auth = request.auth!;
  const staff = auth.baseStaff ?? auth.staff;
  if (staff.role === "super_admin") return "super_admin";
  const body = request.body ?? {};
  const isPatientRoute = request.baseUrl === "/api/patients";
  const patientId = isPatientRoute ? request.params.id ?? body.id : body.patientId;
  let wardId: string | undefined;
  if (patientId) {
    const result = await pool.query("select ward_id from patients where id::text = $1 and organisation_id = $2", [patientId, staff.organisationId]);
    wardId = result.rows[0]?.ward_id;
    if (!wardId && !(isPatientRoute && request.path === "/" && request.method === "POST")) return undefined;
  }
  if (!wardId && request.baseUrl === "/api/config" && request.path === "/wards") {
    // A ward manager may update an existing ward, but cannot create one using
    // the role of an unrelated ward selected in their client.
    wardId = typeof body.id === "string" ? body.id : undefined;
    if (!wardId) return undefined;
  }
  if (!wardId && request.method === "DELETE" && request.params.id) {
    const table = request.path.startsWith("/rota-assignments/") ? "rota_assignments"
      : request.path.startsWith("/staff-shift-assignments/") ? "staff_shift_assignments" : undefined;
    if (table) {
      const result = await pool.query(`select ward_id from ${table} where id::text = $1 and organisation_id = $2`, [request.params.id, staff.organisationId]);
      wardId = result.rows[0]?.ward_id;
      if (!wardId) return undefined;
    }
  }
  // Staff's primary ward may differ from the ward whose assignment is edited.
  if (!wardId && request.baseUrl !== "/api/staff") wardId = body.wardId ?? request.params.wardId;
  wardId ??= typeof request.query.wardId === "string" ? request.query.wardId : request.header("x-ward-id");
  const role = roleInWard(staff, wardId);
  if (role) {
    auth.baseStaff = staff;
    auth.wardId = wardId;
    auth.staff = { ...staff, role };
  }
  return role;
}
