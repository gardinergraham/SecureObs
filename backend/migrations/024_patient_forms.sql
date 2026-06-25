alter table patients
  add column if not exists patient_forms jsonb not null default '[]'::jsonb;
