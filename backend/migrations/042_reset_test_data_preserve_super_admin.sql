-- One-time pre-production reset.
-- Remove all test/customer data while retaining the SecureObs super-admin login.
-- The schema and migration history are intentionally preserved.

delete from family_portal_accounts;
delete from patient_tasks;
delete from safety_incidents;
delete from patient_care_plans;
delete from patient_notes;
delete from shift_handovers;
delete from medication_administrations;
delete from medication_prescriptions;
delete from food_fluid_entries;
delete from news2_readings;
delete from observations;
delete from missed_observations;
delete from security_checks;
delete from security_areas;
delete from rota_assignments;
delete from staff_shift_assignments;
delete from patients;
delete from staff_access_lockouts;
delete from audit_events;

update staff_members
set ward_id = null,
    allowed_site_ids = '{}',
    allowed_ward_ids = '{}',
    active = true,
    updated_at = now()
where role = 'super_admin';

delete from staff_members
where role <> 'super_admin';

delete from wards;
delete from sites;
delete from organisation_settings;

delete from organisations
where id not in (
  select distinct organisation_id
  from staff_members
  where role = 'super_admin'
);

insert into organisation_settings (
  organisation_id,
  nfc_staff_code_format,
  subscription_plan,
  feature_overrides,
  service_status,
  suspension_message,
  site_limit_override,
  wards_per_site_limit_override
)
select
  organisation_id,
  'passcode={STAFFCODE}',
  'hospital',
  '{}'::jsonb,
  'active',
  '',
  null,
  null
from (
  select distinct organisation_id
  from staff_members
  where role = 'super_admin'
) super_admin_organisations
on conflict (organisation_id) do update set
  nfc_staff_code_format = excluded.nfc_staff_code_format,
  logo_data_uri = null,
  subscription_plan = excluded.subscription_plan,
  feature_overrides = excluded.feature_overrides,
  service_status = excluded.service_status,
  suspension_message = excluded.suspension_message,
  site_limit_override = excluded.site_limit_override,
  wards_per_site_limit_override = excluded.wards_per_site_limit_override,
  updated_at = now();
