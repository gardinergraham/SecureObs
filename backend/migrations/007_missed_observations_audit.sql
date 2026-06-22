create table if not exists missed_observations (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null,
  patient_name text not null,
  ward_id text not null,
  due_at timestamptz not null,
  recorded_at timestamptz not null,
  allocated_staff_id text,
  allocated_staff_name text not null,
  recorded_by_staff_id text,
  recorded_by_name text not null,
  reason text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists missed_observations_organisation_ward_idx
  on missed_observations (organisation_id, ward_id, due_at desc);

create table if not exists audit_events (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  actor_staff_id text,
  actor_staff_code text,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  outcome text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_organisation_occurred_idx
  on audit_events (organisation_id, occurred_at desc);

create index if not exists audit_events_entity_idx
  on audit_events (entity_type, entity_id);
