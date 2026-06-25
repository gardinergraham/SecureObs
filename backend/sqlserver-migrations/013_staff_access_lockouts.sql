if object_id('dbo.staff_access_lockouts', 'U') is null
begin
  create table dbo.staff_access_lockouts (
    id nvarchar(255) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    staff_code nvarchar(100) not null,
    staff_code_normalized nvarchar(100) not null,
    attempt_type nvarchar(50) not null,
    failed_count int not null default 0,
    first_failed_at datetimeoffset not null default sysdatetimeoffset(),
    locked_until datetimeoffset null,
    unlock_requires_nurse_in_charge bit not null default 0,
    ward_id nvarchar(100) null,
    last_failure_reason nvarchar(255) null,
    unlocked_at datetimeoffset null,
    unlocked_by_staff_id uniqueidentifier null,
    unlocked_by_staff_code nvarchar(100) null,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset(),
    constraint uq_staff_access_lockout_code_attempt unique (organisation_id, staff_code_normalized, attempt_type)
  );
end;
