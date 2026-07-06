alter table patients
  add column if not exists patient_voice_profile jsonb,
  add column if not exists patient_voice_check_ins jsonb not null default '[]'::jsonb,
  add column if not exists family_sharing jsonb,
  add column if not exists family_contributions jsonb not null default '[]'::jsonb;
