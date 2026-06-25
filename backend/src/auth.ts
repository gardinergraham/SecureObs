import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { recordAuditEvent } from "./audit.js";
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
    session: SessionPayload;
  };
};

export function createStaffSession(staff: StaffMemberRecord): AuthSession {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + config.sessionTtlMinutes * 60 * 1000;
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

    if (!roles.includes(auth.staff.role)) {
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
