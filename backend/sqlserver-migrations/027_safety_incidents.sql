if object_id('dbo.safety_incidents', 'U') is null
begin
  create table dbo.safety_incidents (
    id nvarchar(255) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(255) not null references dbo.patients(id),
    ward_id nvarchar(255) not null references dbo.wards(id),
    category nvarchar(100) not null,
    severity nvarchar(10) not null check (severity in ('green', 'amber', 'red')),
    status nvarchar(20) not null check (status in ('open', 'acknowledged', 'resolved')),
    title nvarchar(200) not null,
    details nvarchar(max) not null,
    immediate_action nvarchar(max) not null default '',
    body_areas nvarchar(max) not null default '[]',
    patient_account nvarchar(max) not null default '',
    owner_staff_id nvarchar(255) null,
    owner_name nvarchar(255) null,
    reported_by_staff_id nvarchar(255) not null,
    reported_by_name nvarchar(255) not null,
    reported_by_staff_code nvarchar(255) not null,
    reported_at datetimeoffset not null,
    acknowledged_by_staff_id nvarchar(255) null,
    acknowledged_by_name nvarchar(255) null,
    acknowledged_at datetimeoffset null,
    resolution_notes nvarchar(max) null,
    resolved_by_staff_id nvarchar(255) null,
    resolved_by_name nvarchar(255) null,
    resolved_at datetimeoffset null
  );

  create index safety_incidents_ward_status_idx
    on dbo.safety_incidents (organisation_id, ward_id, status, severity, reported_at desc);

  create index safety_incidents_patient_date_idx
    on dbo.safety_incidents (organisation_id, patient_id, reported_at desc);
end;
