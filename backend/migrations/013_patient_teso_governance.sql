alter table patients
  add column if not exists enhanced_observation jsonb,
  add column if not exists teso_history jsonb not null default '[]'::jsonb;
