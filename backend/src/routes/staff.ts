import { Router } from "express";
import { z } from "zod";

import { auditActorFromBody, recordAuditEvent } from "../audit.js";
import { createStaffSession, requireAuthenticated, requireStaffRole, type AuthenticatedRequest } from "../auth.js";
import { dataProvider } from "../data/provider.js";
import { DuplicateStaffCodeError, StaffLookupAmbiguousError } from "../data/types.js";
import { pool } from "../db/pool.js";
import { optionalOrganisationIdSchema, requireOrganisationId } from "./organisation.js";

const router = Router();
const failedAttemptLimit = 5;
const failedAttemptWindowMinutes = 10;
const lockoutMinutes = 10;

const staffLookupSchema = z.object({
  staffCode: z.string().min(1),
  organisationId: z.string().uuid().optional()
});

const bankStaffPinLookupSchema = z.object({
  staffCode: z.string().min(1),
  loginPin: z.string().min(1),
  organisationId: z.string().uuid()
});

const unlockAccessSchema = z.object({
  lockedStaffCode: z.string().min(1),
  nurseInChargeStaffCode: z.string().min(1),
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
    z.enum(["nurse", "hcf", "ot", "security", "manager", "doctor"])
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
  active: z.boolean().default(true),
  actorStaffId: z.string().optional(),
  actorStaffCode: z.string().optional()
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

router.get("/session", async (request: AuthenticatedRequest, response, next) => {
  try {
    const auth = requireAuthenticated(request, response);
    if (!auth) return;

    response.json({ staff: auth.staff });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireStaffRole(["manager", "nurse"]), async (request, response, next) => {
  try {
    const parsed = staffMemberSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Invalid staff member", details: parsed.error.flatten() });
      return;
    }

    const organisationId = requireOrganisationId(request, response);
    if (!organisationId) return;
    if (parsed.data.employmentType === "bank") {
      if (!parsed.data.accessStartsAt || !parsed.data.accessExpiresAt) {
        response.status(400).json({ error: "Bank/agency staff need a start and end access time" });
        return;
      }

      const existingStaff = await dataProvider.staff.list(organisationId);
      const conflictingAssignment = findOverlappingVirtualCardAssignment({
        code: parsed.data.staffCode,
        editingStaffId: parsed.data.id,
        expiresAt: parsed.data.accessExpiresAt,
        staff: existingStaff,
        startsAt: parsed.data.accessStartsAt
      });

      if (conflictingAssignment) {
        await recordAuditEvent({
          organisationId,
          ...auditActorFromBody(request.body),
          eventType: "staff.bank_card_assignment",
          entityType: "staff_member",
          entityId: conflictingAssignment.id ?? null,
          outcome: "failure",
          details: {
            virtualNfcCode: parsed.data.staffCode,
            reason: "overlapping_assignment",
            assignedToName: conflictingAssignment.name,
            accessStartsAt: conflictingAssignment.accessStartsAt ?? null,
            accessExpiresAt: conflictingAssignment.accessExpiresAt ?? null
          }
        });
        response.status(409).json({
          error: `Virtual NFC code ${parsed.data.staffCode} is already assigned to ${conflictingAssignment.name} for an overlapping access window`
        });
        return;
      }
    }

    const staff = await dataProvider.staff.upsert({ ...parsed.data, organisationId });
    const actor = auditActorFromBody(request.body);
    await recordAuditEvent({
      organisationId,
      actorStaffId: actor.actorStaffId ?? staff.id,
      actorStaffCode: actor.actorStaffCode ?? staff.staffCode,
      eventType: "staff.upsert",
      entityType: "staff_member",
      entityId: staff.id,
      details: { staffCode: staff.staffCode, role: staff.role, employmentType: staff.employmentType }
    });
    if (staff.employmentType === "bank") {
      await recordAuditEvent({
        organisationId,
        actorStaffId: actor.actorStaffId ?? staff.id,
        actorStaffCode: actor.actorStaffCode ?? staff.staffCode,
        eventType: "staff.bank_card_assignment",
        entityType: "staff_member",
        entityId: staff.id,
        details: {
          virtualNfcCode: staff.staffCode,
          assignedToName: staff.name,
          role: staff.role,
          designation: staff.designation ?? null,
          accessStartsAt: staff.accessStartsAt ?? null,
          accessExpiresAt: staff.accessExpiresAt ?? null,
          wardId: staff.wardId,
          allowedWardIds: staff.allowedWardIds,
          active: staff.active
        }
      });
    }
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

    response.json({ staff, session: createStaffSession(staff) });
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

    if (parsed.data.organisationId) {
      const activeLock = await getActiveAccessLockout(parsed.data.organisationId, parsed.data.staffCode, "staff_lookup");
      if (activeLock) {
        await recordLockedAttempt(parsed.data.organisationId, parsed.data.staffCode, "staff_lookup", activeLock);
        response.status(423).json({ error: lockoutMessage(activeLock) });
        return;
      }
    }

    const staff = await dataProvider.staff.findActiveByCode(parsed.data.staffCode, parsed.data.organisationId);

    if (!staff) {
      if (parsed.data.organisationId) {
        await recordAccessFailure({
          organisationId: parsed.data.organisationId,
          staffCode: parsed.data.staffCode,
          attemptType: "staff_lookup",
          reason: "not_found"
        });
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

    await clearAccessLockout(staff.organisationId, staff.staffCode, "staff_lookup");
    await recordAuditEvent({
      organisationId: staff.organisationId,
      actorStaffId: staff.id,
      actorStaffCode: staff.staffCode,
      eventType: "staff.lookup",
      entityType: "staff_member",
      entityId: staff.id,
      details: { staffCode: staff.staffCode, employmentType: staff.employmentType }
    });
    response.json({ staff, session: createStaffSession(staff) });
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
      response.status(400).json({ error: "Virtual NFC code, PIN and organisationId are required" });
      return;
    }

    const staff = await dataProvider.staff.findActiveByCode(parsed.data.staffCode, parsed.data.organisationId);
    const activeLock = await getActiveAccessLockout(parsed.data.organisationId, parsed.data.staffCode, "bank_pin_login");
    if (activeLock) {
      await recordLockedAttempt(parsed.data.organisationId, parsed.data.staffCode, "bank_pin_login", activeLock);
      response.status(423).json({ error: lockoutMessage(activeLock) });
      return;
    }

    if (!staff || staff.employmentType !== "bank" || staff.loginPin !== parsed.data.loginPin) {
      await recordAccessFailure({
        organisationId: parsed.data.organisationId,
        staffCode: parsed.data.staffCode,
        attemptType: "bank_pin_login",
        reason: staff ? "invalid_pin_or_type" : "not_found",
        staff
      });
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

    await clearAccessLockout(staff.organisationId, staff.staffCode, "bank_pin_login");
    await recordAuditEvent({
      organisationId: staff.organisationId,
      actorStaffId: staff.id,
      actorStaffCode: staff.staffCode,
      eventType: "staff.bank_pin_login",
      entityType: "staff_member",
      entityId: staff.id,
      details: {
        virtualNfcCode: staff.staffCode,
        assignedToName: staff.name,
        role: staff.role,
        accessStartsAt: staff.accessStartsAt ?? null,
        accessExpiresAt: staff.accessExpiresAt ?? null
      }
    });
    response.json({ staff, session: createStaffSession(staff) });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: error.message });
      return;
    }

    next(error);
  }
});

router.post("/unlock-access", async (request, response, next) => {
  try {
    const parsed = unlockAccessSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({ error: "Locked STAFFCODE, nurse in charge STAFFCODE and organisationId are required" });
      return;
    }

    const lockouts = await getActiveAccessLockouts(parsed.data.organisationId, parsed.data.lockedStaffCode);
    if (lockouts.length === 0) {
      response.json({ ok: true, unlocked: false, message: "No active lockout found for that STAFFCODE." });
      return;
    }

    const lockedStaff = await dataProvider.staff.findActiveByCode(parsed.data.lockedStaffCode, parsed.data.organisationId);
    const nurseInCharge = await dataProvider.staff.findActiveByCode(parsed.data.nurseInChargeStaffCode, parsed.data.organisationId);

    if (!lockedStaff?.wardId || !nurseInCharge) {
      await recordAuditEvent({
        organisationId: parsed.data.organisationId,
        actorStaffCode: parsed.data.nurseInChargeStaffCode,
        eventType: "staff.access_unlock",
        entityType: "staff_member",
        entityId: lockedStaff?.id ?? null,
        outcome: "failure",
        details: { lockedStaffCode: parsed.data.lockedStaffCode, reason: "staff_or_nurse_not_found" }
      });
      response.status(403).json({ error: "Unlock was not accepted. Wait 10 minutes or ask the nurse in charge." });
      return;
    }

    const nurseCanUnlock = await isCurrentNurseInCharge({
      organisationId: parsed.data.organisationId,
      nurseStaffId: nurseInCharge.id ?? "",
      wardId: lockedStaff.wardId
    });

    if (!nurseCanUnlock) {
      await recordAuditEvent({
        organisationId: parsed.data.organisationId,
        actorStaffId: nurseInCharge.id,
        actorStaffCode: nurseInCharge.staffCode,
        eventType: "staff.access_unlock",
        entityType: "staff_member",
        entityId: lockedStaff.id ?? null,
        outcome: "failure",
        details: {
          lockedStaffCode: parsed.data.lockedStaffCode,
          wardId: lockedStaff.wardId,
          reason: "not_current_nurse_in_charge"
        }
      });
      response.status(403).json({ error: "Only the nurse in charge for the current shift can unlock this sign-in." });
      return;
    }

    await clearAllAccessLockouts(parsed.data.organisationId, parsed.data.lockedStaffCode, nurseInCharge);
    await recordAuditEvent({
      organisationId: parsed.data.organisationId,
      actorStaffId: nurseInCharge.id,
      actorStaffCode: nurseInCharge.staffCode,
      eventType: "staff.access_unlock",
      entityType: "staff_member",
      entityId: lockedStaff.id ?? null,
      details: { lockedStaffCode: lockedStaff.staffCode, wardId: lockedStaff.wardId }
    });
    response.json({ ok: true, unlocked: true, message: "Sign-in lock has been cleared." });
  } catch (error) {
    if (error instanceof StaffLookupAmbiguousError) {
      response.status(409).json({ error: error.message });
      return;
    }

    next(error);
  }
});

export { router as staffRouter };

function findOverlappingVirtualCardAssignment({
  code,
  editingStaffId,
  expiresAt,
  staff,
  startsAt
}: {
  code: string;
  editingStaffId?: string;
  expiresAt: string;
  staff: Array<{
    id?: string;
    name: string;
    staffCode: string;
    employmentType?: string;
    accessStartsAt?: string | null;
    accessExpiresAt?: string | null;
    active?: boolean;
  }>;
  startsAt: string;
}) {
  const normalisedCode = code.trim().toLowerCase();

  return staff.find((member) => {
    if (member.id === editingStaffId || member.employmentType !== "bank" || member.active === false) {
      return false;
    }

    return (
      member.staffCode.trim().toLowerCase() === normalisedCode &&
      rangesOverlap(startsAt, expiresAt, member.accessStartsAt, member.accessExpiresAt)
    );
  });
}

function rangesOverlap(
  startsAt: string,
  expiresAt: string,
  otherStartsAt?: string | null,
  otherExpiresAt?: string | null
) {
  if (!otherStartsAt || !otherExpiresAt) {
    return false;
  }

  const start = new Date(startsAt).getTime();
  const end = new Date(expiresAt).getTime();
  const otherStart = new Date(otherStartsAt).getTime();
  const otherEnd = new Date(otherExpiresAt).getTime();

  if ([start, end, otherStart, otherEnd].some(Number.isNaN)) {
    return false;
  }

  return start < otherEnd && otherStart < end;
}

type AccessAttemptType = "staff_lookup" | "bank_pin_login";
type AccessLockoutRow = {
  staffCode: string;
  attemptType: AccessAttemptType;
  lockedUntil?: string | null;
  unlockRequiresNurseInCharge?: boolean;
  wardId?: string | null;
};

async function getActiveAccessLockout(organisationId: string, staffCode: string, attemptType: AccessAttemptType) {
  const result = await pool.query(
    `
      select
        staff_code as "staffCode",
        attempt_type as "attemptType",
        locked_until as "lockedUntil",
        unlock_requires_nurse_in_charge as "unlockRequiresNurseInCharge",
        ward_id as "wardId"
      from staff_access_lockouts
      where organisation_id = $1
        and staff_code_normalized = lower($2)
        and attempt_type = $3
        and locked_until is not null
        and locked_until > now()
        and unlocked_at is null
      limit 1
    `,
    [organisationId, staffCode.trim(), attemptType]
  );

  return result.rows[0] as AccessLockoutRow | undefined;
}

async function getActiveAccessLockouts(organisationId: string, staffCode: string) {
  const result = await pool.query(
    `
      select
        staff_code as "staffCode",
        attempt_type as "attemptType",
        locked_until as "lockedUntil",
        unlock_requires_nurse_in_charge as "unlockRequiresNurseInCharge",
        ward_id as "wardId"
      from staff_access_lockouts
      where organisation_id = $1
        and staff_code_normalized = lower($2)
        and locked_until is not null
        and locked_until > now()
        and unlocked_at is null
    `,
    [organisationId, staffCode.trim()]
  );

  return result.rows as AccessLockoutRow[];
}

async function recordAccessFailure({
  organisationId,
  staffCode,
  attemptType,
  reason,
  staff
}: {
  organisationId: string;
  staffCode: string;
  attemptType: AccessAttemptType;
  reason: string;
  staff?: {
    id?: string;
    staffCode: string;
    wardId: string;
  } | null;
}) {
  const now = new Date();
  const existingResult = await pool.query(
    `
      select failed_count, first_failed_at as "firstFailedAt"
      from staff_access_lockouts
      where organisation_id = $1 and staff_code_normalized = lower($2) and attempt_type = $3
      limit 1
    `,
    [organisationId, staffCode.trim(), attemptType]
  );
  const existing = existingResult.rows[0] as { failed_count?: number; failedCount?: number; firstFailedAt?: string } | undefined;
  const firstFailedAt = existing?.firstFailedAt ? new Date(existing.firstFailedAt) : now;
  const withinWindow = now.getTime() - firstFailedAt.getTime() <= failedAttemptWindowMinutes * 60 * 1000;
  const nextFailedCount = withinWindow ? Number(existing?.failed_count ?? existing?.failedCount ?? 0) + 1 : 1;
  const shouldLock = nextFailedCount >= failedAttemptLimit;
  const unlockRequiresNurseInCharge = Boolean(staff?.wardId && shouldLock && (await hasCurrentNurseInCharge(organisationId, staff.wardId)));
  const lockedUntil = shouldLock ? new Date(now.getTime() + lockoutMinutes * 60 * 1000).toISOString() : null;

  await pool.query(
    `
      insert into staff_access_lockouts (
        id, organisation_id, staff_code, staff_code_normalized, attempt_type, failed_count,
        first_failed_at, locked_until, unlock_requires_nurse_in_charge, ward_id, last_failure_reason,
        unlocked_at, unlocked_by_staff_id, unlocked_by_staff_code, updated_at
      ) values ($1,$2,$3,lower($3),$4,$5,$6,$7,$8,$9,$10,null,null,null,now())
      on conflict (organisation_id, staff_code_normalized, attempt_type) do update set
        staff_code = excluded.staff_code,
        failed_count = excluded.failed_count,
        first_failed_at = excluded.first_failed_at,
        locked_until = excluded.locked_until,
        unlock_requires_nurse_in_charge = excluded.unlock_requires_nurse_in_charge,
        ward_id = excluded.ward_id,
        last_failure_reason = excluded.last_failure_reason,
        unlocked_at = null,
        unlocked_by_staff_id = null,
        unlocked_by_staff_code = null,
        updated_at = now()
    `,
    [
      `lockout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organisationId,
      staffCode.trim(),
      attemptType,
      nextFailedCount,
      withinWindow ? firstFailedAt.toISOString() : now.toISOString(),
      lockedUntil,
      unlockRequiresNurseInCharge,
      staff?.wardId ?? null,
      reason
    ]
  );

  if (shouldLock) {
    await recordAuditEvent({
      organisationId,
      actorStaffId: staff?.id ?? null,
      actorStaffCode: staff?.staffCode ?? staffCode,
      eventType: "staff.access_lockout",
      entityType: "staff_member",
      entityId: staff?.id ?? null,
      outcome: "failure",
      details: {
        staffCode,
        attemptType,
        failedCount: nextFailedCount,
        lockedUntil,
        unlockRequiresNurseInCharge,
        wardId: staff?.wardId ?? null
      }
    });
  }
}

async function recordLockedAttempt(
  organisationId: string,
  staffCode: string,
  attemptType: AccessAttemptType,
  lockout: AccessLockoutRow
) {
  await recordAuditEvent({
    organisationId,
    actorStaffCode: staffCode,
    eventType: "staff.access_locked_attempt",
    entityType: "staff_member",
    outcome: "failure",
    details: {
      staffCode,
      attemptType,
      lockedUntil: lockout.lockedUntil ?? null,
      unlockRequiresNurseInCharge: Boolean(lockout.unlockRequiresNurseInCharge)
    }
  });
}

async function clearAccessLockout(organisationId: string, staffCode: string, attemptType: AccessAttemptType) {
  await pool.query(
    `
      delete from staff_access_lockouts
      where organisation_id = $1 and staff_code_normalized = lower($2) and attempt_type = $3
    `,
    [organisationId, staffCode.trim(), attemptType]
  );
}

async function clearAllAccessLockouts(
  organisationId: string,
  staffCode: string,
  unlockedBy: { id?: string; staffCode: string }
) {
  await pool.query(
    `
      update staff_access_lockouts
      set unlocked_at = now(),
          unlocked_by_staff_id = $3,
          unlocked_by_staff_code = $4,
          locked_until = null,
          failed_count = 0,
          updated_at = now()
      where organisation_id = $1 and staff_code_normalized = lower($2)
    `,
    [organisationId, staffCode.trim(), unlockedBy.id ?? null, unlockedBy.staffCode]
  );
}

function lockoutMessage(lockout: AccessLockoutRow) {
  const until = lockout.lockedUntil ? new Date(lockout.lockedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "later";
  if (lockout.unlockRequiresNurseInCharge) {
    return `Too many failed attempts. Ask the nurse in charge to unlock this sign-in, or try again after ${until}.`;
  }

  return `Too many failed attempts. Try again after ${until}.`;
}

async function hasCurrentNurseInCharge(organisationId: string, wardId: string) {
  const shift = await getCurrentWardShift(organisationId, wardId);
  if (!shift) {
    return false;
  }

  const result = await pool.query(
    `
      select 1
      from staff_shift_assignments
      where organisation_id = $1
        and ward_id = $2
        and date = $3
        and shift_id = $4
        and nurse_in_charge = true
      limit 1
    `,
    [organisationId, wardId, shift.dateKey, shift.shiftId]
  );

  return Boolean(result.rowCount);
}

async function isCurrentNurseInCharge({
  organisationId,
  nurseStaffId,
  wardId
}: {
  organisationId: string;
  nurseStaffId: string;
  wardId: string;
}) {
  const shift = await getCurrentWardShift(organisationId, wardId);
  if (!shift) {
    return false;
  }

  const result = await pool.query(
    `
      select 1
      from staff_shift_assignments
      where organisation_id = $1
        and ward_id = $2
        and date = $3
        and shift_id = $4
        and staff_id = $5
        and nurse_in_charge = true
      limit 1
    `,
    [organisationId, wardId, shift.dateKey, shift.shiftId, nurseStaffId]
  );

  return Boolean(result.rowCount);
}

async function getCurrentWardShift(organisationId: string, wardId: string) {
  const result = await pool.query(
    `
      select wards.rota_shifts as "rotaShifts"
      from wards
      inner join sites on sites.id = wards.site_id
      where wards.id = $1 and sites.organisation_id = $2
      limit 1
    `,
    [wardId, organisationId]
  );
  const rotaShifts = Array.isArray(result.rows[0]?.rotaShifts) ? result.rows[0].rotaShifts : [];
  const now = new Date();

  for (const shift of rotaShifts) {
    if (!isShiftRecord(shift)) continue;
    const window = getShiftWindow(now, shift.startsAt, shift.endsAt);
    if (now >= window.startsAt && now < window.endsAt) {
      return { shiftId: shift.id, dateKey: formatDateKey(window.dateForAssignment) };
    }
  }

  return undefined;
}

function isShiftRecord(value: unknown): value is { id: string; startsAt: string; endsAt: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.startsAt === "string" && typeof record.endsAt === "string";
}

function getShiftWindow(now: Date, startsAt: string, endsAt: string) {
  const startMinutes = timeToMinutes(startsAt);
  const endMinutes = timeToMinutes(endsAt);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dateForAssignment = new Date(now);
  const starts = new Date(now);
  starts.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
  const ends = new Date(now);
  ends.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

  if (endMinutes <= startMinutes) {
    if (nowMinutes < endMinutes) {
      starts.setDate(starts.getDate() - 1);
      dateForAssignment.setDate(dateForAssignment.getDate() - 1);
    } else {
      ends.setDate(ends.getDate() + 1);
    }
  }

  return { startsAt: starts, endsAt: ends, dateForAssignment };
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
