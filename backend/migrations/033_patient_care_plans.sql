create table if not exists patient_care_plans (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null references patients(id),
  ward_id text not null references wards(id),
  title text not null,
  identified_needs text not null,
  risks_and_triggers text not null default '',
  goals text not null,
  interventions text not null,
  patient_views text not null default '',
  review_date text not null,
  additional_notes text not null default '',
  created_by_staff_id text not null,
  created_by_name text not null,
  created_by_staff_code text not null,
  created_at timestamptz not null
);

create index if not exists patient_care_plans_patient_date_idx
  on patient_care_plans (organisation_id, patient_id, created_at desc);

create index if not exists patient_care_plans_ward_date_idx
  on patient_care_plans (organisation_id, ward_id, created_at desc);
