if object_id('dbo.missed_observations', 'U') is null
begin
  create table dbo.missed_observations (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(120) not null,
    patient_name nvarchar(255) not null,
    ward_id nvarchar(100) not null,
    due_at datetimeoffset not null,
    recorded_at datetimeoffset not null,
    allocated_staff_id nvarchar(120) null,
    allocated_staff_name nvarchar(255) not null,
    recorded_by_staff_id nvarchar(120) null,
    recorded_by_name nvarchar(255) not null,
    reason nvarchar(255) not null,
    details nvarchar(max) not null default '',
    created_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.audit_events', 'U') is null
begin
  create table dbo.audit_events (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    actor_staff_id nvarchar(120) null,
    actor_staff_code nvarchar(100) null,
    event_type nvarchar(120) not null,
    entity_type nvarchar(120) not null,
    entity_id nvarchar(120) null,
    outcome nvarchar(50) not null,
    details nvarchar(max) not null default '{}',
    occurred_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if not exists (select 1 from sys.indexes where name = 'ix_missed_observations_organisation_ward' and object_id = object_id('dbo.missed_observations'))
begin
  create index ix_missed_observations_organisation_ward on dbo.missed_observations(organisation_id, ward_id, due_at desc);
end;

if not exists (select 1 from sys.indexes where name = 'ix_audit_events_organisation_occurred' and object_id = object_id('dbo.audit_events'))
begin
  create index ix_audit_events_organisation_occurred on dbo.audit_events(organisation_id, occurred_at desc);
end;
