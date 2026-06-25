alter table security_areas
  add column if not exists expected_items jsonb not null default '{}'::jsonb;

alter table security_checks
  add column if not exists result_details jsonb not null default '{}'::jsonb;
