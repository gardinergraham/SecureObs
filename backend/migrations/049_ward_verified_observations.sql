alter table wards
  add column if not exists verified_observations_enabled boolean not null default true;
