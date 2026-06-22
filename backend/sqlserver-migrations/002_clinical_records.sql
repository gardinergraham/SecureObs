if object_id('dbo.patients', 'U') is null
begin
  create table dbo.patients (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_number int not null,
    hospital_number nvarchar(100) not null,
    first_name nvarchar(255) not null,
    surname nvarchar(255) not null,
    ward_id nvarchar(100) not null references dbo.wards(id),
    room_number int not null,
    observation_level nvarchar(100) not null default 'Intermittent',
    latest_observation_place nvarchar(100) not null default 'Side room',
    latest_observation_time datetimeoffset not null default sysdatetimeoffset(),
    latest_observed_by nvarchar(255) not null default '',
    latest_presentation nvarchar(100) not null default 'Awake',
    on_off_ward nvarchar(50) not null default 'On ward',
    seclusion bit not null default 0,
    long_term_seclusion bit not null default 0,
    archived bit not null default 0,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.observations', 'U') is null
begin
  create table dbo.observations (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(120) not null,
    observer_name nvarchar(255) not null,
    source nvarchar(100) not null,
    type nvarchar(100) not null,
    location nvarchar(100) not null,
    presentation nvarchar(100) not null,
    comments nvarchar(max) not null default '',
    observed_at datetimeoffset not null,
    created_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.security_checks', 'U') is null
begin
  create table dbo.security_checks (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    area_id nvarchar(100) not null,
    check_name nvarchar(255) not null,
    checked_by nvarchar(255) not null,
    checked_at datetimeoffset not null,
    notes nvarchar(max) not null default '',
    counted_total int null,
    created_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.news2_readings', 'U') is null
begin
  create table dbo.news2_readings (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(120) not null,
    recorded_at datetimeoffset not null,
    recorded_by nvarchar(255) not null,
    respiration_rate int not null,
    spo2 int not null,
    spo2_scale nvarchar(50) not null,
    on_oxygen bit not null default 0,
    systolic_bp int not null,
    pulse int not null,
    consciousness nvarchar(100) not null,
    temperature decimal(4, 1) not null,
    total_score int not null,
    created_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.medication_prescriptions', 'U') is null
begin
  create table dbo.medication_prescriptions (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(120) not null,
    drug_name nvarchar(255) not null,
    dose nvarchar(255) not null,
    route nvarchar(100) not null,
    administration_times nvarchar(max) not null default '[]',
    start_date datetimeoffset not null,
    stop_date datetimeoffset null,
    additional_instructions nvarchar(max) not null default '',
    prescribed_by nvarchar(255) not null,
    prescribed_at datetimeoffset not null,
    discontinued_by nvarchar(255) null,
    discontinued_at datetimeoffset null,
    discontinue_reason nvarchar(max) null,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if object_id('dbo.medication_administrations', 'U') is null
begin
  create table dbo.medication_administrations (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    prescription_id nvarchar(120) not null,
    patient_id nvarchar(120) not null,
    scheduled_at datetimeoffset not null,
    status nvarchar(100) not null,
    omission_code nvarchar(20) null,
    recorded_by nvarchar(255) not null,
    recorded_at datetimeoffset not null,
    notes nvarchar(max) not null default '',
    created_at datetimeoffset not null default sysdatetimeoffset()
  );
end;

if not exists (select 1 from sys.indexes where name = 'ix_patients_organisation_ward' and object_id = object_id('dbo.patients'))
begin
  create index ix_patients_organisation_ward on dbo.patients(organisation_id, ward_id, archived, room_number);
end;

if not exists (select 1 from sys.indexes where name = 'ix_observations_organisation_patient' and object_id = object_id('dbo.observations'))
begin
  create index ix_observations_organisation_patient on dbo.observations(organisation_id, patient_id, observed_at desc);
end;

if not exists (select 1 from sys.indexes where name = 'ix_news2_organisation_patient' and object_id = object_id('dbo.news2_readings'))
begin
  create index ix_news2_organisation_patient on dbo.news2_readings(organisation_id, patient_id, recorded_at desc);
end;
