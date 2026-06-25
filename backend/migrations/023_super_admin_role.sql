alter table staff_members
  drop constraint if exists staff_members_role_check;

alter table staff_members
  add constraint staff_members_role_check
  check (role in ('nurse', 'hcf', 'ot', 'security', 'manager', 'doctor', 'super_admin'));

insert into staff_members (
  organisation_id,
  key_number,
  staff_code,
  display_name,
  role,
  designation,
  can_prescribe,
  employment_type,
  login_pin,
  login_pin_hash,
  ward_id,
  allowed_site_ids,
  allowed_ward_ids,
  active
)
values (
  '00000000-0000-0000-0000-000000000001',
  9999,
  'Super4dmin',
  'SecureObs Super Admin',
  'super_admin',
  'SecureObs Super Admin',
  false,
  'permanent',
  null,
  'pbkdf2_sha256$120000$d12taG11VLYpVnwRUTeNlA$A0Z2BCxzgIn2gEheObOvrbUsGHRqSsEVS8MAFFNu1Ag',
  'ward-1',
  array['site-1', 'site-2'],
  array['ward-1', 'ward-2', 'ward-3'],
  true
)
on conflict (organisation_id, staff_code) do update set
  key_number = excluded.key_number,
  display_name = excluded.display_name,
  role = excluded.role,
  designation = excluded.designation,
  can_prescribe = excluded.can_prescribe,
  employment_type = excluded.employment_type,
  login_pin = null,
  login_pin_hash = excluded.login_pin_hash,
  ward_id = excluded.ward_id,
  allowed_site_ids = excluded.allowed_site_ids,
  allowed_ward_ids = excluded.allowed_ward_ids,
  active = true,
  updated_at = now();
