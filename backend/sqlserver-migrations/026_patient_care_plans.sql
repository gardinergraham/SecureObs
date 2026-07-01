if object_id('dbo.patient_care_plans', 'U') is null
begin
  create table dbo.patient_care_plans (
    id nvarchar(255) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(255) not null references dbo.patients(id),
    ward_id nvarchar(255) not null references dbo.wards(id),
    title nvarchar(200) not null,
    identified_needs nvarchar(max) not null,
    risks_and_triggers nvarchar(max) not null default '',
    goals nvarchar(max) not null,
    interventions nvarchar(max) not null,
    patient_views nvarchar(max) not null default '',
    review_date nvarchar(50) not null,
    additional_notes nvarchar(max) not null default '',
    created_by_staff_id nvarchar(255) not null,
    created_by_name nvarchar(255) not null,
    created_by_staff_code nvarchar(255) not null,
    created_at datetimeoffset not null
  );

  create index patient_care_plans_patient_date_idx
    on dbo.patient_care_plans (organisation_id, patient_id, created_at desc);

  create index patient_care_plans_ward_date_idx
    on dbo.patient_care_plans (organisation_id, ward_id, created_at desc);
end;
