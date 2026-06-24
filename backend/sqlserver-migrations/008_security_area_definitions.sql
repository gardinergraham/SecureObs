if object_id('dbo.security_areas', 'U') is null
begin
  create table dbo.security_areas (
    id nvarchar(100) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    ward_id nvarchar(100) not null references dbo.wards(id),
    name nvarchar(255) not null,
    frequency_minutes int not null,
    requires_count bit not null default 0,
    category nvarchar(100) not null default 'custom',
    frequency_type nvarchar(100) not null default 'per_shift',
    active bit not null default 1,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if not exists (select 1 from sys.indexes where name = 'ix_security_areas_organisation_ward' and object_id = object_id('dbo.security_areas'))
begin
  create index ix_security_areas_organisation_ward on dbo.security_areas(organisation_id, ward_id);
end;

if not exists (select 1 from sys.indexes where name = 'ix_security_areas_active' and object_id = object_id('dbo.security_areas'))
begin
  create index ix_security_areas_active on dbo.security_areas(active);
end;
