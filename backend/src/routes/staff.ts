import { Router } from "express";
import { z } from "zod";

import { dataProvider } from "../data/provider.js";
import { DuplicateStaffCodeError, StaffLookupAmbiguousError } from "../data/types.js";

const router = Router();

const staffLookupSchema = z.object({
  staffCode: z.string().min(1),
  organisationId: z.string().uuid().optional()
});

const staffMemberSchema = z.object({
  id: z.string().optional(),
  organisationId: z.string().uuid().optional().default("00000000-0000-0000-0000-000000000001"),
  keyNumber: z.number().int().optional(),
  staffCode: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["nurse", "hcf", "security", "manager", "doctor"]),
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

router.get("/", async (_request, response, next) => {
  try {
    response.json({ staff: await dataProvider.staff.list() });
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

    const staff = await dataProvider.staff.upsert(parsed.data);
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

export { router as staffRouter };
