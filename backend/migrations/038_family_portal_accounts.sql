create table if not exists family_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  patient_id text not null references patients(id) on delete cascade,
  contact_id text not null,
  username text not null,
  username_normalized text not null,
  pin_hash text,
  activation_code_hash text,
  activation_expires_at timestamptz,
  active boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  token_version integer not null default 1,
  last_login_at timestamptz,
  created_by_staff_id text,
  created_by_staff_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, patient_id, contact_id),
  unique (username_normalized)
);

create index if not exists family_portal_accounts_patient_idx
  on family_portal_accounts (organisation_id, patient_id, active);

create index if not exists family_portal_accounts_username_idx
  on family_portal_accounts (username_normalized, active);
