create table if not exists rota_assignments (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  ward_id text not null,
  staff_id text not null,
  role text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  patient_id text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rota_assignments_organisation_ward_idx
  on rota_assignments (organisation_id, ward_id, starts_at);

create table if not exists staff_shift_assignments (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  ward_id text not null,
  shift_id text not null,
  staff_id text not null,
  date text not null,
  nurse_in_charge boolean not null default false,
  medication_nurse boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_shift_assignments_organisation_ward_date_idx
  on staff_shift_assignments (organisation_id, ward_id, date);
