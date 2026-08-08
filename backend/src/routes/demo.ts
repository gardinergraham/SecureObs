import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";

import { config } from "../config.js";
import { pool } from "../db/pool.js";

const router = Router();
const attempts = new Map<string, number[]>();
const registrationSchema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional().default(""),
  acceptedTerms: z.literal(true),
  website: z.string().max(0).optional().default("")
});

router.post("/register", async (request, response, next) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (!config.demoMode || !config.demoRegistrationEnabled) {
    response.status(404).json({ error: "Demo registration is not available" });
    return;
  }

  const clientKey = request.ip || request.socket.remoteAddress || "unknown";
  if (!allowRegistrationAttempt(clientKey)) {
    response.status(429).json({ error: "Too many trial requests. Please try again later or contact SecureObs." });
    return;
  }

  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Please complete the required trial registration details" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await removeExpiredDemoOrganisations(client);
    const existing = await client.query(
      `select expires_at as "expiresAt"
       from demo_trials
       where lower(contact_email) = lower($1) and expires_at > now()
       order by expires_at desc limit 1`,
      [parsed.data.email]
    );
    if (existing.rows[0]) {
      await client.query("rollback");
      response.status(409).json({
        error: "An active SecureObs trial already exists for this email address.",
        expiresAt: existing.rows[0].expiresAt
      });
      return;
    }

    const organisationId = crypto.randomUUID();
    const suffix = crypto.randomBytes(4).toString("hex");
    const siteId = `demo-site-${suffix}`;
    const wardId = `demo-ward-${suffix}`;
    const staffCode = `Demo${crypto.randomBytes(3).toString("hex")}`;
    const loginPin = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + config.demoTrialDays * 24 * 60 * 60 * 1000);

    await client.query("insert into organisations (id, name) values ($1, $2)", [organisationId, parsed.data.organisationName]);
    await client.query(
      `insert into organisation_settings (
         organisation_id, nfc_staff_code_format, subscription_plan, feature_overrides,
         service_status, suspension_message, site_limit_override, wards_per_site_limit_override
       ) values ($1, 'passcode={STAFFCODE}', 'hospital', '{}'::jsonb, 'active', '', 1, 1)`,
      [organisationId]
    );
    await client.query("insert into sites (id, organisation_id, name) values ($1, $2, $3)", [
      siteId, organisationId, `${parsed.data.organisationName} Demonstration Site`
    ]);
    await client.query(
      `insert into wards (
         id, site_id, name, service_type, observation_interval_minutes, news2_enabled,
         enhanced_observations_enabled, security_checks_enabled, medication_chart_enabled,
         staff_rota_enabled, assessment_forms_enabled, food_fluid_chart_enabled
       ) values ($1, $2, 'Demonstration Ward', 'Health and social care demonstration', 15, true, true, true, true, true, true, true)`,
      [wardId, siteId]
    );
    await client.query(
      `insert into staff_members (
         organisation_id, staff_code, display_name, role, designation, can_prescribe,
         employment_type, access_starts_at, access_expires_at, login_pin_hash,
         login_pin_must_change, ward_id, allowed_site_ids, allowed_ward_ids, active
       ) values ($1, $2, $3, 'manager', 'Trial manager', false, 'permanent', now(), $4, $5, false, $6, $7, $8, true)`,
      [organisationId, staffCode, parsed.data.contactName, expiresAt, hashPin(loginPin), wardId, [siteId], [wardId]]
    );

    const fictionalPatients = [
      { firstName: "Alex", surname: "Morgan", hospitalNumber: `DEMO-${suffix}-01`, room: 1, dob: "1978-04-12", allergies: "Penicillin" },
      { firstName: "Sam", surname: "Taylor", hospitalNumber: `DEMO-${suffix}-02`, room: 2, dob: "1986-09-23", allergies: "" },
      { firstName: "Jordan", surname: "Williams", hospitalNumber: `DEMO-${suffix}-03`, room: 3, dob: "1969-01-08", allergies: "Latex" },
      { firstName: "Casey", surname: "Brown", hospitalNumber: `DEMO-${suffix}-04`, room: 4, dob: "1992-11-17", allergies: "" }
    ];
    for (const [index, patient] of fictionalPatients.entries()) {
      await client.query(
        `insert into patients (
           id, organisation_id, patient_number, hospital_number, first_name, surname,
           ward_id, room_number, observation_level, latest_observation_place,
           latest_observation_time, latest_observed_by, latest_presentation, on_off_ward,
           allergies, date_of_birth
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Bedroom',now(),'Demo seed','Awake','On ward',$10,$11)`,
        [
          `demo-patient-${suffix}-${index + 1}`, organisationId, index + 1, patient.hospitalNumber,
          patient.firstName, patient.surname, wardId, patient.room,
          index === 3 ? "Enhanced" : "Intermittent", patient.allergies, patient.dob
        ]
      );
    }

    await client.query(
      `insert into demo_trials (
         organisation_id, organisation_name, contact_name, contact_email, contact_phone,
         staff_code, expires_at, accepted_terms_at
       ) values ($1,$2,$3,$4,$5,$6,$7,now())`,
      [
        organisationId, parsed.data.organisationName, parsed.data.contactName,
        parsed.data.email, parsed.data.phone, staffCode, expiresAt
      ]
    );
    await client.query("commit");

    response.status(201).json({
      trial: {
        organisationName: parsed.data.organisationName,
        staffCode,
        loginPin,
        expiresAt: expiresAt.toISOString(),
        trialDays: config.demoTrialDays,
        downloadPageUrl: `${config.publicWebsiteUrl}/demo-download`
      }
    });
  } catch (error) {
    await client.query("rollback");
    next(error);
  } finally {
    client.release();
  }
});

function allowRegistrationAttempt(clientKey: string) {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const recent = (attempts.get(clientKey) ?? []).filter((value) => value >= windowStart);
  if (recent.length >= 5) return false;
  recent.push(now);
  attempts.set(clientKey, recent);
  return true;
}

function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(pin, salt, 120000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

async function removeExpiredDemoOrganisations(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }) {
  const expired = await client.query(
    `select organisation_id as "organisationId"
     from demo_trials
     where expires_at < now() - ($1::text || ' days')::interval
     for update`,
    [config.demoRetentionDays]
  ) as { rows?: Array<{ organisationId: string }> };
  const organisationIds = expired.rows?.map((row) => row.organisationId) ?? [];
  if (organisationIds.length === 0) return;

  const scopedTables = [
    "family_portal_accounts",
    "patient_tasks",
    "safety_incidents",
    "patient_care_plans",
    "patient_notes",
    "shift_handovers",
    "medication_administrations",
    "medication_prescriptions",
    "food_fluid_entries",
    "news2_readings",
    "observations",
    "missed_observations",
    "security_checks",
    "security_areas",
    "rota_assignments",
    "staff_shift_assignments",
    "patients",
    "staff_access_lockouts",
    "audit_events",
    "billing_accounts"
  ];
  for (const table of scopedTables) {
    await client.query(`delete from ${table} where organisation_id = any($1::uuid[])`, [organisationIds]);
  }
  await client.query("delete from demo_trials where organisation_id = any($1::uuid[])", [organisationIds]);
  await client.query("delete from staff_members where organisation_id = any($1::uuid[])", [organisationIds]);
  await client.query(
    "delete from wards where site_id in (select id from sites where organisation_id = any($1::uuid[]))",
    [organisationIds]
  );
  await client.query("delete from sites where organisation_id = any($1::uuid[])", [organisationIds]);
  await client.query("delete from organisation_settings where organisation_id = any($1::uuid[])", [organisationIds]);
  await client.query("delete from organisations where id = any($1::uuid[])", [organisationIds]);
}

export { router as demoRouter };
