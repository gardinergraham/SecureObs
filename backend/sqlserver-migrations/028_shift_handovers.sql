if object_id('dbo.shift_handovers', 'U') is null
begin
  create table dbo.shift_handovers (
    id nvarchar(255) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    ward_id nvarchar(255) not null references dbo.wards(id),
    shift_id nvarchar(255) not null,
    shift_label nvarchar(255) not null,
    shift_started_at datetimeoffset not null,
    shift_ended_at datetimeoffset not null,
    overall_summary nvarchar(max) not null,
    patient_summaries nvarchar(max) not null default '[]',
    created_by_staff_id nvarchar(255) not null,
    created_by_name nvarchar(255) not null,
    created_by_staff_code nvarchar(255) not null,
    created_at datetimeoffset not null
  );

  create index shift_handovers_ward_date_idx
    on dbo.shift_handovers (organisation_id, ward_id, shift_started_at desc);
end;
