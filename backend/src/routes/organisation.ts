import type { Request, Response } from "express";
import { z } from "zod";

type RequestWithAuth = Request & {
  auth?: {
    staff: {
      organisationId: string;
      role?: string;
    };
  };
};

export const fallbackOrganisationId = "00000000-0000-0000-0000-000000000001";
export const organisationIdSchema = z.string().uuid();
export const optionalOrganisationIdSchema = organisationIdSchema.optional().default(fallbackOrganisationId);

export function getOrganisationId(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : fallbackOrganisationId;
}

export function requireOrganisationId(request: RequestWithAuth, response: Response) {
  const headerOrganisationId = request.header("x-organisation-id");
  const queryOrganisationId = request.query.organisationId;
  const bodyOrganisationId = isObjectRecord(request.body) ? request.body.organisationId : undefined;
  const value = headerOrganisationId ?? queryOrganisationId ?? bodyOrganisationId;
  const parsed = organisationIdSchema.safeParse(value);

  if (!parsed.success) {
    response.status(400).json({ error: "organisationId is required" });
    return undefined;
  }

  if (
    request.auth &&
    request.auth.staff.role !== "super_admin" &&
    request.auth.staff.organisationId !== parsed.data
  ) {
    response.status(403).json({ error: "Staff session is not authorised for this organisation" });
    return undefined;
  }

  return parsed.data;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
