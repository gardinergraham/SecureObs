create table if not exists demo_trials (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null unique references organisations(id),
  organisation_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null default '',
  staff_code text not null unique,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_terms_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists demo_trials_email_active_idx
  on demo_trials (lower(contact_email), expires_at desc);

create index if not exists demo_trials_expiry_idx
  on demo_trials (expires_at);
