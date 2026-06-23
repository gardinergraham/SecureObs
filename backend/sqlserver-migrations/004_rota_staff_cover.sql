if object_id('dbo.rota_assignments', 'U') is null
begin
  create table dbo.rota_assignments (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    ward_id nvarchar(100) not null,
    staff_id nvarchar(120) not null,
    role nvarchar(100) not null,
    starts_at datetimeoffset not null,
    ends_at datetimeoffset not null,
    patient_id nvarchar(120) null,
    notes nvarchar(max) not null default '',
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if not exists (select 1 from sys.indexes where name = 'ix_rota_assignments_organisation_ward' and object_id = object_id('dbo.rota_assignments'))
begin
  create index ix_rota_assignments_organisation_ward on dbo.rota_assignments(organisation_id, ward_id, starts_at);
end;

if object_id('dbo.staff_shift_assignments', 'U') is null
begin
  create table dbo.staff_shift_assignments (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    ward_id nvarchar(100) not null,
    shift_id nvarchar(120) not null,
    staff_id nvarchar(120) not null,
    date nvarchar(20) not null,
    nurse_in_charge bit not null default 0,
    medication_nurse bit not null default 0,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if not exists (select 1 from sys.indexes where name = 'ix_staff_shift_assignments_organisation_ward_date' and object_id = object_id('dbo.staff_shift_assignments'))
begin
  create index ix_staff_shift_assignments_organisation_ward_date on dbo.staff_shift_assignments(organisation_id, ward_id, date);
end;
