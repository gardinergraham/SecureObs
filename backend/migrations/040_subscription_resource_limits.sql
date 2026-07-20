alter table organisation_settings
  add column if not exists site_limit_override integer,
  add column if not exists wards_per_site_limit_override integer;

alter table organisation_settings drop constraint if exists organisation_settings_site_limit_check;
alter table organisation_settings add constraint organisation_settings_site_limit_check
  check (site_limit_override is null or site_limit_override >= 1);

alter table organisation_settings drop constraint if exists organisation_settings_ward_limit_check;
alter table organisation_settings add constraint organisation_settings_ward_limit_check
  check (wards_per_site_limit_override is null or wards_per_site_limit_override >= 1);
