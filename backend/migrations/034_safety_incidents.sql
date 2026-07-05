create table if not exists safety_incidents (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null references patients(id),
  ward_id text not null references wards(id),
  category text not null,
  severity text not null check (severity in ('green', 'amber', 'red')),
  status text not null check (status in ('open', 'acknowledged', 'resolved')),
  title text not null,
  details text not null,
  immediate_action text not null default '',
  body_areas jsonb not null default '[]'::jsonb,
  patient_account text not null default '',
  owner_staff_id text,
  owner_name text,
  reported_by_staff_id text not null,
  reported_by_name text not null,
  reported_by_staff_code text not null,
  reported_at timestamptz not null,
  acknowledged_by_staff_id text,
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  resolution_notes text,
  resolved_by_staff_id text,
  resolved_by_name text,
  resolved_at timestamptz
);

create index if not exists safety_incidents_ward_status_idx
  on safety_incidents (organisation_id, ward_id, status, severity, reported_at desc);

create index if not exists safety_incidents_patient_date_idx
  on safety_incidents (organisation_id, patient_id, reported_at desc);
