if object_id('dbo.schema_migrations', 'U') is null
begin
  create table dbo.schema_migrations (
    id nvarchar(255) not null primary key,
    applied_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.organisations', 'U') is null
begin
  create table dbo.organisations (
    id uniqueidentifier not null primary key default newid(),
    name nvarchar(255) not null,
    created_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.sites', 'U') is null
begin
  create table dbo.sites (
    id nvarchar(100) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    name nvarchar(255) not null
  );
end;

if object_id('dbo.wards', 'U') is null
begin
  create table dbo.wards (
    id nvarchar(100) not null primary key,
    site_id nvarchar(100) not null references dbo.sites(id),
    name nvarchar(255) not null,
    service_type nvarchar(100) not null,
    observation_interval_minutes int not null default 15,
    news2_enabled bit not null default 1,
    enhanced_observations_enabled bit not null default 1,
    security_checks_enabled bit not null default 1,
    medication_chart_enabled bit not null default 1,
    staff_rota_enabled bit not null default 1,
    assessment_forms_enabled bit not null default 0
  );
end;

if object_id('dbo.staff_members', 'U') is null
begin
  create table dbo.staff_members (
    id uniqueidentifier not null primary key default newid(),
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    key_number int null,
    staff_code nvarchar(100) not null,
    display_name nvarchar(255) not null,
    role nvarchar(50) not null check (role in ('nurse', 'hcf', 'ot', 'security', 'manager', 'doctor', 'super_admin')),
    designation nvarchar(255) null,
    can_prescribe bit not null default 0,
    employment_type nvarchar(50) not null default 'permanent',
    access_starts_at datetimeoffset null,
    access_expires_at datetimeoffset null,
    login_pin nvarchar(100) null,
    ward_id nvarchar(100) null references dbo.wards(id),
    allowed_site_ids nvarchar(max) not null default '[]',
    allowed_ward_ids nvarchar(max) not null default '[]',
    active bit not null default 1,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset(),
    constraint uq_staff_members_organisation_staff_code unique (organisation_id, staff_code)
  );
end;

if not exists (select 1 from sys.indexes where name = 'ix_staff_members_staff_code' and object_id = object_id('dbo.staff_members'))
begin
  create index ix_staff_members_staff_code on dbo.staff_members(staff_code);
end;

if not exists (select 1 from sys.indexes where name = 'ix_staff_members_active' and object_id = object_id('dbo.staff_members'))
begin
  create index ix_staff_members_active on dbo.staff_members(active);
end;

if not exists (select 1 from dbo.organisations where id = '00000000-0000-0000-0000-000000000001')
begin
  insert into dbo.organisations (id, name)
  values ('00000000-0000-0000-0000-000000000001', 'SecureObs Demo');
end;
