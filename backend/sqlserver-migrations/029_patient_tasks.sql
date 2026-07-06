if object_id('dbo.patient_tasks', 'U') is null
begin
  create table dbo.patient_tasks (
    id nvarchar(255) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(255) not null references dbo.patients(id),
    ward_id nvarchar(255) not null references dbo.wards(id),
    title nvarchar(200) not null,
    details nvarchar(max) not null default '',
    category nvarchar(100) not null,
    priority nvarchar(10) not null check (priority in ('green', 'amber', 'red')),
    status nvarchar(20) not null check (status in ('open', 'accepted', 'completed', 'cancelled')),
    due_at datetimeoffset not null,
    recurrence nvarchar(20) not null check (recurrence in ('none', 'every_shift', 'daily')),
    assigned_to_staff_id nvarchar(255) null,
    assigned_to_name nvarchar(255) null,
    assigned_role nvarchar(50) null,
    source_type nvarchar(30) null,
    source_id nvarchar(255) null,
    created_by_staff_id nvarchar(255) not null,
    created_by_name nvarchar(255) not null,
    created_by_staff_code nvarchar(255) not null,
    created_at datetimeoffset not null,
    accepted_by_staff_id nvarchar(255) null,
    accepted_by_name nvarchar(255) null,
    accepted_at datetimeoffset null,
    completion_notes nvarchar(max) null,
    completed_by_staff_id nvarchar(255) null,
    completed_by_name nvarchar(255) null,
    completed_at datetimeoffset null,
    cancelled_by_staff_id nvarchar(255) null,
    cancelled_by_name nvarchar(255) null,
    cancelled_at datetimeoffset null
  );

  create index patient_tasks_ward_status_due_idx
    on dbo.patient_tasks (organisation_id, ward_id, status, due_at);

  create index patient_tasks_patient_due_idx
    on dbo.patient_tasks (organisation_id, patient_id, due_at desc);
end;
