if col_length('dbo.wards', 'food_fluid_chart_enabled') is null
begin
  alter table dbo.wards add food_fluid_chart_enabled bit not null default 0;
end;

update dbo.wards
set food_fluid_chart_enabled = 1
where service_type = 'Care home';

if object_id('dbo.food_fluid_entries', 'U') is null
begin
  create table dbo.food_fluid_entries (
    id nvarchar(120) not null primary key,
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(120) not null,
    recorded_at datetimeoffset not null,
    recorded_by nvarchar(255) not null,
    meal_period nvarchar(50) not null,
    entry_type nvarchar(30) not null,
    item_description nvarchar(255) not null,
    portion_offered nvarchar(255) not null,
    intake_level nvarchar(50) not null,
    fluid_offered_ml int null,
    fluid_taken_ml int null,
    assistance_notes nvarchar(max) not null default '',
    comments nvarchar(max) not null default '',
    created_at datetimeoffset not null default sysdatetimeoffset(),
    constraint CK_food_fluid_meal_period check (meal_period in ('Breakfast', 'Mid-morning', 'Lunch', 'Mid-afternoon', 'Evening meal', 'Bedtime')),
    constraint CK_food_fluid_entry_type check (entry_type in ('Food', 'Drink', 'Supplement')),
    constraint CK_food_fluid_intake_level check (intake_level in ('Refused', 'Less than half', 'Half', 'More than half', 'All')),
    constraint CK_food_fluid_offered_nonnegative check (fluid_offered_ml is null or fluid_offered_ml >= 0),
    constraint CK_food_fluid_taken_nonnegative check (fluid_taken_ml is null or fluid_taken_ml >= 0),
    constraint CK_food_fluid_taken_within_offered check (fluid_offered_ml is null or fluid_taken_ml is null or fluid_taken_ml <= fluid_offered_ml)
  );
end;

if not exists (
  select 1
  from sys.indexes
  where name = 'ix_food_fluid_organisation_patient'
    and object_id = object_id('dbo.food_fluid_entries')
)
begin
  create index ix_food_fluid_organisation_patient
    on dbo.food_fluid_entries(organisation_id, patient_id, recorded_at desc);
end;
