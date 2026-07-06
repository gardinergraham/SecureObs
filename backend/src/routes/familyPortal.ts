import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { recordAuditEvent } from "../audit.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { requireAuthenticated, requireStaffRole, type AuthenticatedRequest } from "../auth.js";

export const familyAccessRouter = Router();
export const familyPortalRouter = Router();

const activationLifetimeHours = 48;
const familySessionMinutes = 30;
const failedAttemptLimit = 5;
const lockoutMinutes = 15;

const invitationSchema = z.object({
  patientId: z.string().min(1),
  contactId: z.string().min(1),
  username: z.string().trim().min(5).max(80).optional()
});
const activationSchema = z.object({
  username: z.string().trim().min(1).max(80),
  activationCode: z.string().trim().min(6).max(20),
  pin: z.string().regex(/^\d{6}$/)
});
const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^\d{6}$/)
});
const contributionSchema = z.object({
  body: z.string().trim().min(1).max(20_000)
});

type ShareCategory = "Patient voice" | "Progress summary" | "Care-plan goals" | "Approved notes";
type FamilyContact = {
  id: string;
  name: string;
  relationship: string;
  categories: ShareCategory[];
  active: boolean;
  canContribute: boolean;
  accessExpiresAt?: string;
};
type SharingPreferences = {
  patientConsented: boolean;
  contacts: FamilyContact[];
  sharedNoteIds: string[];
};
type FamilyAccount = {
  id: string;
  organisationId: string;
  patientId: string;
  contactId: string;
  username: string;
  pinHash?: string | null;
  activationCodeHash?: string | null;
  activationExpiresAt?: string | null;
  active: boolean;
  failedAttempts: number;
  lockedUntil?: string | null;
  tokenVersion: number;
};
type FamilySessionPayload = {
  familyAccountId: string;
  organisationId: string;
  patientId: string;
  contactId: string;
  tokenVersion: number;
  issuedAt: number;
  expiresAt: number;
};

familyAccessRouter.post(
  "/invitations",
  requireStaffRole(["nurse", "manager", "doctor", "super_admin"]),
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const parsed = invitationSchema.safeParse(request.body);
      const auth = requireAuthenticated(request, response);
      if (!auth) return;
      if (!parsed.success) {
        response.status(400).json({ error: "Patient, approved contact and a valid username are required" });
        return;
      }

      const patient = await loadPatientSharing(auth.staff.organisationId, parsed.data.patientId);
      const contact = patient?.familySharing?.contacts.find((item) => item.id === parsed.data.contactId);
      if (!patient || !patient.familySharing?.patientConsented || !contact?.active || isExpired(contact.accessExpiresAt)) {
        response.status(409).json({ error: "Patient consent and an active, unexpired contact are required" });
        return;
      }
      if (auth.staff.role !== "super_admin" && !auth.staff.allowedWardIds.includes(patient.wardId)) {
        response.status(403).json({ error: "Staff session is not authorised for this ward" });
        return;
      }

      const username = parsed.data.username || (await createAvailableUsername(contact.name));
      const normalizedUsername = normalizeUsername(username);
      if (!/^[a-zA-Z0-9._-]{5,80}$/.test(username)) {
        response.status(400).json({
          error: "Username must be 5–80 characters and use only letters, numbers, dots, dashes or underscores"
        });
        return;
      }
      const conflicting = await pool.query(
        `select id from family_portal_accounts where username_normalized = $1
         and not (organisation_id = $2 and patient_id = $3 and contact_id = $4)`,
        [normalizedUsername, auth.staff.organisationId, parsed.data.patientId, parsed.data.contactId]
      );
      if (conflicting.rows[0]) {
        response.status(409).json({ error: "That family username is already in use" });
        return;
      }

      const activationCode = createNumericCode(8);
      const activationExpiresAt = new Date(Date.now() + activationLifetimeHours * 60 * 60 * 1000);
      const result = await pool.query(
        `
          insert into family_portal_accounts (
            organisation_id, patient_id, contact_id, username, username_normalized,
            pin_hash, activation_code_hash, activation_expires_at, active, failed_attempts,
            locked_until, token_version, created_by_staff_id, created_by_staff_code
          ) values ($1,$2,$3,$4,$5,null,$6,$7,true,0,null,1,$8,$9)
          on conflict (organisation_id, patient_id, contact_id) do update set
            username = excluded.username,
            username_normalized = excluded.username_normalized,
            pin_hash = null,
            activation_code_hash = excluded.activation_code_hash,
            activation_expires_at = excluded.activation_expires_at,
            active = true,
            failed_attempts = 0,
            locked_until = null,
            token_version = family_portal_accounts.token_version + 1,
            updated_at = now()
          returning id, username
        `,
        [
          auth.staff.organisationId,
          parsed.data.patientId,
          parsed.data.contactId,
          username,
          normalizedUsername,
          hashSecret(activationCode),
          activationExpiresAt.toISOString(),
          auth.staff.id,
          auth.staff.staffCode
        ]
      );
      await recordAuditEvent({
        organisationId: auth.staff.organisationId,
        actorStaffId: auth.staff.id,
        actorStaffCode: auth.staff.staffCode,
        eventType: "family_portal.invitation_issued",
        entityType: "family_portal_account",
        entityId: result.rows[0].id,
        details: {
          patientId: parsed.data.patientId,
          contactId: parsed.data.contactId,
          accessExpiresAt: contact.accessExpiresAt ?? null
        }
      });
      response.status(201).json({
        invitation: {
          username: result.rows[0].username,
          activationCode,
          activationExpiresAt: activationExpiresAt.toISOString(),
          portalPath: "/family"
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

familyAccessRouter.get(
  "/accounts",
  requireStaffRole(["nurse", "manager", "doctor", "super_admin"]),
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const auth = requireAuthenticated(request, response);
      if (!auth) return;
      const patientId = typeof request.query.patientId === "string" ? request.query.patientId : "";
      if (!patientId) {
        response.status(400).json({ error: "patientId is required" });
        return;
      }
      const result = await pool.query(
        `
          select contact_id as "contactId", username, active,
            (pin_hash is not null) as activated,
            activation_expires_at as "activationExpiresAt",
            last_login_at as "lastLoginAt"
          from family_portal_accounts
          where organisation_id = $1 and patient_id = $2
          order by created_at
        `,
        [auth.staff.organisationId, patientId]
      );
      response.json({ accounts: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

familyAccessRouter.post(
  "/accounts/:contactId/revoke",
  requireStaffRole(["nurse", "manager", "doctor", "super_admin"]),
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const auth = requireAuthenticated(request, response);
      if (!auth) return;
      const result = await pool.query(
        `
          update family_portal_accounts
          set active = false, token_version = token_version + 1, updated_at = now()
          where organisation_id = $1 and contact_id = $2
          returning id, patient_id as "patientId"
        `,
        [auth.staff.organisationId, request.params.contactId]
      );
      if (!result.rows[0]) {
        response.status(404).json({ error: "Family access account not found" });
        return;
      }
      await recordAuditEvent({
        organisationId: auth.staff.organisationId,
        actorStaffId: auth.staff.id,
        actorStaffCode: auth.staff.staffCode,
        eventType: "family_portal.access_revoked",
        entityType: "family_portal_account",
        entityId: result.rows[0].id,
        details: { patientId: result.rows[0].patientId, contactId: request.params.contactId }
      });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

familyPortalRouter.post("/activate", async (request, response, next) => {
  try {
    const parsed = activationSchema.safeParse(request.body);
    if (!parsed.success) {
      genericAuthenticationFailure(response);
      return;
    }
    const account = await loadAccountByUsername(parsed.data.username);
    const isLocked = account?.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now();
    if (
      !account ||
      !account.active ||
      isLocked ||
      !account.activationCodeHash ||
      !account.activationExpiresAt ||
      new Date(account.activationExpiresAt).getTime() <= Date.now() ||
      !verifySecret(parsed.data.activationCode, account.activationCodeHash)
    ) {
      if (account && !isLocked) await recordFailedLogin(account);
      if (!account) verifySecret(parsed.data.activationCode, dummySecretHash);
      await auditFamilyFailure(account, "activation_failed");
      genericAuthenticationFailure(response);
      return;
    }
    const access = await validateCurrentAccess(account);
    if (!access) {
      genericAuthenticationFailure(response);
      return;
    }
    const updated = await pool.query(
      `
        update family_portal_accounts
        set pin_hash = $2, activation_code_hash = null, activation_expires_at = null,
          failed_attempts = 0, locked_until = null, token_version = token_version + 1, updated_at = now()
        where id = $1
        returning token_version as "tokenVersion"
      `,
      [account.id, hashSecret(parsed.data.pin)]
    );
    account.tokenVersion = updated.rows[0].tokenVersion;
    await recordAuditEvent({
      organisationId: account.organisationId,
      eventType: "family_portal.activated",
      entityType: "family_portal_account",
      entityId: account.id,
      details: { patientId: account.patientId, contactId: account.contactId }
    });
    response.json(await createAuthenticatedResponse(account));
  } catch (error) {
    next(error);
  }
});

familyPortalRouter.post("/login", async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      genericAuthenticationFailure(response);
      return;
    }
    const account = await loadAccountByUsername(parsed.data.username);
    const isLocked = account?.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now();
    if (!account || !account.active || !account.pinHash || isLocked || !verifySecret(parsed.data.pin, account.pinHash)) {
      if (account && !isLocked) await recordFailedLogin(account);
      if (!account) verifySecret(parsed.data.pin, dummySecretHash);
      await auditFamilyFailure(account, "login_failed");
      genericAuthenticationFailure(response);
      return;
    }
    const access = await validateCurrentAccess(account);
    if (!access) {
      genericAuthenticationFailure(response);
      return;
    }
    await pool.query(
      `update family_portal_accounts
       set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
       where id = $1`,
      [account.id]
    );
    await recordAuditEvent({
      organisationId: account.organisationId,
      eventType: "family_portal.login",
      entityType: "family_portal_account",
      entityId: account.id,
      details: { patientId: account.patientId, contactId: account.contactId }
    });
    response.json(await createAuthenticatedResponse(account));
  } catch (error) {
    next(error);
  }
});

familyPortalRouter.get("/me", async (request, response, next) => {
  try {
    const account = await requireFamilyAccount(request, response);
    if (!account) return;
    response.setHeader("Cache-Control", "no-store");
    response.json({ portal: await buildPortalView(account) });
  } catch (error) {
    next(error);
  }
});

familyPortalRouter.post("/contributions", async (request, response, next) => {
  try {
    const account = await requireFamilyAccount(request, response);
    if (!account) return;
    const parsed = contributionSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Add a contribution before submitting" });
      return;
    }
    const access = await validateCurrentAccess(account);
    if (!access?.contact.canContribute) {
      response.status(403).json({ error: "This account does not have contribution permission" });
      return;
    }
    const contribution = {
      id: `family-contribution-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      contactId: access.contact.id,
      contactName: access.contact.name,
      body: parsed.data.body,
      submittedAt: new Date().toISOString(),
      source: "Family portal",
      reviewStatus: "Awaiting staff review"
    };
    await pool.query(
      `
        update patients
        set family_contributions = coalesce(family_contributions, '[]'::jsonb) || $3::jsonb,
          updated_at = now()
        where organisation_id = $1 and id = $2
      `,
      [account.organisationId, account.patientId, JSON.stringify([contribution])]
    );
    await recordAuditEvent({
      organisationId: account.organisationId,
      eventType: "family_portal.contribution_submitted",
      entityType: "patient",
      entityId: account.patientId,
      details: { accountId: account.id, contactId: account.contactId, contributionId: contribution.id }
    });
    response.status(201).json({ contribution });
  } catch (error) {
    next(error);
  }
});

async function loadAccountByUsername(username: string): Promise<FamilyAccount | undefined> {
  const result = await pool.query(
    `
      select id, organisation_id as "organisationId", patient_id as "patientId",
        contact_id as "contactId", username, pin_hash as "pinHash",
        activation_code_hash as "activationCodeHash",
        activation_expires_at as "activationExpiresAt", active,
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        token_version as "tokenVersion"
      from family_portal_accounts where username_normalized = $1
    `,
    [normalizeUsername(username)]
  );
  return result.rows[0];
}

async function loadAccountById(id: string): Promise<FamilyAccount | undefined> {
  const result = await pool.query(
    `
      select id, organisation_id as "organisationId", patient_id as "patientId",
        contact_id as "contactId", username, pin_hash as "pinHash",
        activation_code_hash as "activationCodeHash",
        activation_expires_at as "activationExpiresAt", active,
        failed_attempts as "failedAttempts", locked_until as "lockedUntil",
        token_version as "tokenVersion"
      from family_portal_accounts where id = $1
    `,
    [id]
  );
  return result.rows[0];
}

async function loadPatientSharing(organisationId: string, patientId: string) {
  const result = await pool.query(
    `
      select p.id, p.ward_id as "wardId", p.first_name as "firstName", p.surname,
        p.observation_level as "observationLevel",
        p.latest_observation_place as "latestObservationPlace",
        p.latest_presentation as "latestPresentation", p.on_off_ward as "onOffWard",
        p.patient_voice_profile as "patientVoiceProfile",
        p.patient_voice_check_ins as "patientVoiceCheckIns",
        p.family_sharing as "familySharing", p.family_contributions as "familyContributions",
        w.name as "wardName"
      from patients p join wards w on w.id = p.ward_id
      where p.organisation_id = $1 and p.id = $2 and p.archived = false
    `,
    [organisationId, patientId]
  );
  return result.rows[0] as
    | {
        id: string;
        wardId: string;
        firstName: string;
        surname: string;
        wardName: string;
        observationLevel: string;
        latestObservationPlace: string;
        latestPresentation: string;
        onOffWard: string;
        patientVoiceProfile?: Record<string, unknown>;
        patientVoiceCheckIns?: Record<string, unknown>[];
        familySharing?: SharingPreferences;
        familyContributions?: Array<Record<string, unknown> & { contactId?: string }>;
      }
    | undefined;
}

async function validateCurrentAccess(account: FamilyAccount) {
  if (!account.active) return undefined;
  const patient = await loadPatientSharing(account.organisationId, account.patientId);
  const contact = patient?.familySharing?.contacts.find((item) => item.id === account.contactId);
  if (!patient?.familySharing?.patientConsented || !contact?.active || isExpired(contact.accessExpiresAt)) {
    return undefined;
  }
  return { patient, contact };
}

async function buildPortalView(account: FamilyAccount) {
  const access = await validateCurrentAccess(account);
  if (!access) throw new FamilyAccessRevokedError();
  const { patient, contact } = access;
  const categories = new Set(contact.categories);
  const view: Record<string, unknown> = {
    patient: { name: `${patient.firstName} ${patient.surname}`, wardName: patient.wardName },
    contact: {
      name: contact.name,
      relationship: contact.relationship,
      categories: contact.categories,
      canContribute: contact.canContribute,
      accessExpiresAt: contact.accessExpiresAt ?? null
    }
  };
  if (categories.has("Progress summary")) {
    view.progressSummary = {
      wardStatus: patient.onOffWard,
      latestRecordedLocation: patient.latestObservationPlace,
      latestRecordedPresentation: patient.latestPresentation,
      observationSupport: patient.observationLevel
    };
  }
  if (categories.has("Patient voice")) {
    view.patientVoice = {
      profile: patient.patientVoiceProfile ?? null,
      latestCheckIn: patient.patientVoiceCheckIns?.[0] ?? null
    };
  }
  if (categories.has("Care-plan goals")) {
    const plans = await pool.query(
      `
        select title, goals, patient_views as "patientViews", review_date as "reviewDate"
        from patient_care_plans
        where organisation_id = $1 and patient_id = $2
        order by created_at desc limit 1
      `,
      [account.organisationId, account.patientId]
    );
    view.carePlan = plans.rows[0] ?? null;
  }
  if (categories.has("Approved notes")) {
    const noteIds = patient.familySharing?.sharedNoteIds ?? [];
    if (noteIds.length) {
      const notes = await pool.query(
        `
          select id, body, recorded_by_name as "recordedByName", recorded_at as "recordedAt"
          from patient_notes
          where organisation_id = $1 and patient_id = $2 and id = any($3::text[])
          order by recorded_at desc
        `,
        [account.organisationId, account.patientId, noteIds]
      );
      view.approvedNotes = notes.rows;
    } else {
      view.approvedNotes = [];
    }
  }
  view.contributions = (patient.familyContributions ?? [])
    .filter((entry) => entry.contactId === contact.id)
    .sort((left, right) => String(right.submittedAt ?? "").localeCompare(String(left.submittedAt ?? "")));
  return view;
}

async function createAuthenticatedResponse(account: FamilyAccount) {
  return {
    session: createFamilySession(account),
    portal: await buildPortalView(account)
  };
}

function createFamilySession(account: FamilyAccount) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + familySessionMinutes * 60 * 1000;
  const payload: FamilySessionPayload = {
    familyAccountId: account.id,
    organisationId: account.organisationId,
    patientId: account.patientId,
    contactId: account.contactId,
    tokenVersion: account.tokenVersion,
    issuedAt,
    expiresAt
  };
  return {
    token: signFamilyPayload(payload),
    expiresAt: new Date(expiresAt).toISOString()
  };
}

async function requireFamilyAccount(request: Request, response: Response) {
  try {
    const header = request.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) throw new Error("Missing session");
    const session = verifyFamilyToken(header.slice("bearer ".length).trim());
    const account = await loadAccountById(session.familyAccountId);
    if (
      !account ||
      !account.active ||
      account.organisationId !== session.organisationId ||
      account.patientId !== session.patientId ||
      account.contactId !== session.contactId ||
      account.tokenVersion !== session.tokenVersion ||
      !(await validateCurrentAccess(account))
    ) {
      throw new Error("Access no longer available");
    }
    return account;
  } catch {
    response.status(401).json({ error: "Your family portal session has expired or access is no longer available" });
    return undefined;
  }
}

function signFamilyPayload(payload: FamilySessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", `${config.sessionSecret}:family-portal`)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyFamilyToken(token: string): FamilySessionPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Malformed session");
  const expected = crypto
    .createHmac("sha256", `${config.sessionSecret}:family-portal`)
    .update(encoded)
    .digest("base64url");
  if (!safeEqual(signature, expected)) throw new Error("Invalid session");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as FamilySessionPayload;
  if (!payload.familyAccountId || payload.expiresAt <= Date.now()) throw new Error("Expired session");
  return payload;
}

async function recordFailedLogin(account: FamilyAccount) {
  const failures = account.failedAttempts + 1;
  const lockedUntil =
    failures >= failedAttemptLimit
      ? new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString()
      : null;
  await pool.query(
    `update family_portal_accounts
     set failed_attempts = $2, locked_until = $3, updated_at = now() where id = $1`,
    [account.id, failures, lockedUntil]
  );
}

async function auditFamilyFailure(account: FamilyAccount | undefined, reason: string) {
  if (!account) return;
  await recordAuditEvent({
    organisationId: account.organisationId,
    eventType: "family_portal.authentication_failed",
    entityType: "family_portal_account",
    entityId: account.id,
    outcome: "failure",
    details: { reason }
  });
}

async function createAvailableUsername(name: string) {
  const base =
    name
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ".")
      .slice(0, 54) || "family";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${base}-${createNumericCode(4)}`;
    const result = await pool.query(
      `select id from family_portal_accounts where username_normalized = $1`,
      [normalizeUsername(candidate)]
    );
    if (!result.rows[0]) return candidate;
  }
  return `family-${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function createNumericCode(length: number) {
  let result = "";
  while (result.length < length) {
    result += String(crypto.randomInt(0, 10));
  }
  return result;
}

function hashSecret(secret: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(secret, salt, 120_000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

const dummySecretHash = hashSecret(crypto.randomBytes(18).toString("base64url"));

function verifySecret(secret: string, encodedHash: string) {
  const [algorithm, iterationsText, salt, expectedHash] = encodedHash.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;
  const actualHash = crypto.pbkdf2Sync(secret, salt, iterations, 32, "sha256").toString("base64url");
  return safeEqual(actualHash, expectedHash);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function genericAuthenticationFailure(response: Response) {
  response.status(401).json({ error: "The family username or security details were not recognised" });
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return true;
  expiry.setHours(23, 59, 59, 999);
  return expiry.getTime() < Date.now();
}

class FamilyAccessRevokedError extends Error {}
