if object_id('dbo.patient_notes', 'U') is null
begin
  create table dbo.patient_notes (
    id nvarchar(255) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(255) not null references dbo.patients(id),
    ward_id nvarchar(255) not null references dbo.wards(id),
    body nvarchar(max) not null,
    recorded_by_staff_id nvarchar(255) not null,
    recorded_by_name nvarchar(255) not null,
    recorded_by_staff_code nvarchar(255) not null,
    recorded_at datetimeoffset not null,
    created_at datetimeoffset not null default sysdatetimeoffset()
  );

  create index patient_notes_patient_date_idx
    on dbo.patient_notes (organisation_id, patient_id, recorded_at desc);

  create index patient_notes_ward_date_idx
    on dbo.patient_notes (organisation_id, ward_id, recorded_at desc);
end;
