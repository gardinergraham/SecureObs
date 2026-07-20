alter table organisation_settings
  add column if not exists subscription_plan text not null default 'hospital',
  add column if not exists feature_overrides jsonb not null default '{}'::jsonb,
  add column if not exists service_status text not null default 'active',
  add column if not exists suspension_message text not null default '',
  add column if not exists site_limit_override integer,
  add column if not exists wards_per_site_limit_override integer;

alter table organisation_settings drop constraint if exists organisation_settings_site_limit_check;
alter table organisation_settings add constraint organisation_settings_site_limit_check
  check (site_limit_override is null or site_limit_override >= 1);

alter table organisation_settings drop constraint if exists organisation_settings_ward_limit_check;
alter table organisation_settings add constraint organisation_settings_ward_limit_check
  check (wards_per_site_limit_override is null or wards_per_site_limit_override >= 1);

alter table organisation_settings drop constraint if exists organisation_settings_subscription_plan_check;
alter table organisation_settings add constraint organisation_settings_subscription_plan_check
  check (subscription_plan in ('essential', 'professional', 'enterprise', 'hospital'));

alter table organisation_settings drop constraint if exists organisation_settings_service_status_check;
alter table organisation_settings add constraint organisation_settings_service_status_check
  check (service_status in ('active', 'suspended'));
