create table if not exists shift_handovers (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  ward_id text not null references wards(id),
  shift_id text not null,
  shift_label text not null,
  shift_started_at timestamptz not null,
  shift_ended_at timestamptz not null,
  overall_summary text not null,
  patient_summaries jsonb not null default '[]'::jsonb,
  created_by_staff_id text not null,
  created_by_name text not null,
  created_by_staff_code text not null,
  created_at timestamptz not null
);

create index if not exists shift_handovers_ward_date_idx
  on shift_handovers (organisation_id, ward_id, shift_started_at desc);
