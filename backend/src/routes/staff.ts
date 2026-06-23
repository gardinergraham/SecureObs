import { Router } from "express";
import { z } from "zod";

import { recordAuditEvent } from "../audit.js";
import { dataProvider } from "../data/provider.js";
import { DuplicateStaffCodeError, StaffLookupAmbiguousError } from "../data/types.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();

const staffLookupSchema = z.object({
  staffCode: z.string().min(1),
  organisationId: z.string().uuid().optional()
});

const bankStaffPinLookupSchema = z.object({
  staffCode: z.string().min(1),
  loginPin: z.string().min(1),
  organisationId: z.string().uuid()
});

const staffMemberSchema = z.object({
  id: z.string().optional(),
  organisationId: optionalOrganisationIdSchema,
  keyNumber: z.number().int().optional(),
  staffCode: z.string().min(1),
  name: z.string().min(1),
  role: z.preprocess(
    (value) => (typeof value === "string" ? value.toLowerCase() : value),
    z.enum(["nurse", "hcf", "security", "manager", "doctor"])
  ),
  designation: z.string().optional(),
  canPrescribe: z.boolean().default(false),
  employmentType: z.enum(["permanent", "bank"]).default("permanent"),
  accessStartsAt: z.string().datetime().optional(),
  accessExpiresAt: z.string().datetime().optional(),
  loginPin: z.string().optional(),
  wardId: z.string().min(1),
  allowedSiteIds: z.array(z.string()).min(1),
  allowedWardIds: z.array(z.string()).min(1),
  active: z.boolean().default(true)
});

router.get("/", async (request, response, next) => {
  try {
    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    response.json({ staff: await dataProvider.staff.list(organisationId) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  try {
    const parsed = staffMemberSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Invalid staff member", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    const staff = await dataProvider.staff.upsert({ ...parsed.data, organisationId });
    await recordAuditEvent({
      organisationId,
      actorStaffId: staff.id,
      actorStaffCode: staff.staffCode,
      eventType: "staff.upsert",
      entityType: "staff_member",
      entityId: staff.id,
      details: { staffCode: staff.staffCode, role: staff.role, employmentType: staff.employmentType }
    });
    response.status(201).json({ staff });
  } catch (error) {
    if (error instanceof DuplicateStaffCodeError) {
      response.status(409).json({ error: error.message });
      return;
    }

    next(error);
  }
});

router.get("/by-code/:staffCode", async (request, response, next) => {
  try {
    const staff = await dataProvider.staff.findActiveByCode(request.params.staffCode);

    if (!staff) {
      response.status(404).json({ error: "Staff member not found" });
      return;
    }

    response.json({ staff });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: error.message });
      return;
    }

    next(error);
  }
});

router.post("/lookup", async (request, response, next) => {
  try {
    const parsed = staffLookupSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "staffCode is required" });
      return;
    }

    const staff = await dataProvider.staff.findActiveByCode(parsed.data.staffCode, parsed.data.organisationId);

    if (!staff) {
      if (parsed.data.organisationId) {
        await recordAuditEvent({
          organisationId: parsed.data.organisationId,
          eventType: "staff.lookup",
          entityType: "staff_member",
          entityId: null,
          outcome: "failure",
          details: { staffCode: parsed.data.staffCode, reason: "not_found" }
        });
      }
      response.status(404).json({ error: "Staff member not found" });
      return;
    }

    await recordAuditEvent({
      organisationId: staff.organisationId,
      actorStaffId: staff.id,
      actorStaffCode: staff.staffCode,
      eventType: "staff.lookup",
      entityType: "staff_member",
      entityId: staff.id,
      details: { staffCode: staff.staffCode, employmentType: staff.employmentType }
    });
    response.json({ staff });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: error.message });
      return;
    }

    next(error);
  }
});

router.post("/bank-pin-login", async (request, response, next) => {
  try {
    const parsed = bankStaffPinLookupSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "STAFFCODE, PIN and organisationId are required" });
      return;
    }

    const staff = await dataProvider.staff.findActiveByCode(parsed.data.staffCode, parsed.data.organisationId);
    if (!staff || staff.employmentType !== "bank" || staff.loginPin !== parsed.data.loginPin) {
      await recordAuditEvent({
        organisationId: parsed.data.organisationId,
        eventType: "staff.bank_pin_login",
        entityType: "staff_member",
        entityId: staff?.id ?? null,
        outcome: "failure",
        details: { staffCode: parsed.data.staffCode, reason: staff ? "invalid_pin_or_type" : "not_found" }
      });
      response.status(401).json({ error: "Bank staff login was not accepted" });
      return;
    }

    await recordAuditEvent({
      organisationId: staff.organisationId,
      actorStaffId: staff.id,
      actorStaffCode: staff.staffCode,
      eventType: "staff.bank_pin_login",
      entityType: "staff_member",
      entityId: staff.id,
      details: { staffCode: staff.staffCode }
    });
    response.json({ staff });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: error.message });
      return;
    }

    next(error);
  }
});

export { router as staffRouter };
