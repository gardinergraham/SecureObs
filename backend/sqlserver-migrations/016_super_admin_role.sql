declare @constraintName nvarchar(128);

select @constraintName = cc.name
from sys.check_constraints cc
join sys.columns c on c.object_id = cc.parent_object_id
where cc.parent_object_id = object_id('dbo.staff_members')
  and c.name = 'role'
  and cc.definition like '%doctor%';

if @constraintName is not null
begin
  exec('alter table dbo.staff_members drop constraint ' + quotename(@constraintName));
end;

alter table dbo.staff_members
  add constraint ck_staff_members_role
  check (role in ('nurse', 'hcf', 'ot', 'security', 'manager', 'doctor', 'super_admin'));

if exists (
  select 1
  from dbo.staff_members
  where organisation_id = '00000000-0000-0000-0000-000000000001'
    and staff_code = 'Super4dmin'
)
begin
  update dbo.staff_members
  set
    key_number = 9999,
    display_name = 'SecureObs Super Admin',
    role = 'super_admin',
    designation = 'SecureObs Super Admin',
    can_prescribe = 0,
    employment_type = 'permanent',
    login_pin = null,
    login_pin_hash = 'pbkdf2_sha256$120000$d12taG11VLYpVnwRUTeNlA$A0Z2BCxzgIn2gEheObOvrbUsGHRqSsEVS8MAFFNu1Ag',
    ward_id = 'ward-1',
    allowed_site_ids = '["site-1","site-2"]',
    allowed_ward_ids = '["ward-1","ward-2","ward-3"]',
    active = 1,
    updated_at = sysdatetimeoffset()
  where organisation_id = '00000000-0000-0000-0000-000000000001'
    and staff_code = 'Super4dmin';
end
else
begin
  insert into dbo.staff_members (
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
    0,
    'permanent',
    null,
    'pbkdf2_sha256$120000$d12taG11VLYpVnwRUTeNlA$A0Z2BCxzgIn2gEheObOvrbUsGHRqSsEVS8MAFFNu1Ag',
    'ward-1',
    '["site-1","site-2"]',
    '["ward-1","ward-2","ward-3"]',
    1
  );
end;
