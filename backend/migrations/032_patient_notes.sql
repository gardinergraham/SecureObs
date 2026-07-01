create table if not exists patient_notes (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null references patients(id),
  ward_id text not null references wards(id),
  body text not null,
  recorded_by_staff_id text not null,
  recorded_by_name text not null,
  recorded_by_staff_code text not null,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists patient_notes_patient_date_idx
  on patient_notes (organisation_id, patient_id, recorded_at desc);

create index if not exists patient_notes_ward_date_idx
  on patient_notes (organisation_id, ward_id, recorded_at desc);
