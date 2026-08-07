alter table patients
  add column if not exists identification_profile jsonb;
