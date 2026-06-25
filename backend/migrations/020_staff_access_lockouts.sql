create table if not exists staff_access_lockouts (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  staff_code text not null,
  staff_code_normalized text not null,
  attempt_type text not null,
  failed_count integer not null default 0,
  first_failed_at timestamptz not null default now(),
  locked_until timestamptz,
  unlock_requires_nurse_in_charge boolean not null default false,
  ward_id text,
  last_failure_reason text,
  unlocked_at timestamptz,
  unlocked_by_staff_id uuid,
  unlocked_by_staff_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, staff_code_normalized, attempt_type)
);

create index if not exists staff_access_lockouts_active_idx
  on staff_access_lockouts (organisation_id, staff_code_normalized, locked_until);
