alter table wards
  add column if not exists food_fluid_chart_enabled boolean not null default false;

update wards
set food_fluid_chart_enabled = true
where service_type = 'Care home';

create table if not exists food_fluid_entries (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null,
  recorded_at timestamptz not null,
  recorded_by text not null,
  meal_period text not null,
  entry_type text not null,
  item_description text not null,
  portion_offered text not null,
  intake_level text not null,
  fluid_offered_ml integer,
  fluid_taken_ml integer,
  assistance_notes text not null default '',
  comments text not null default '',
  created_at timestamptz not null default now(),
  check (meal_period in ('Breakfast', 'Mid-morning', 'Lunch', 'Mid-afternoon', 'Evening meal', 'Bedtime')),
  check (entry_type in ('Food', 'Drink', 'Supplement')),
  check (intake_level in ('Refused', 'Less than half', 'Half', 'More than half', 'All')),
  check (fluid_offered_ml is null or fluid_offered_ml >= 0),
  check (fluid_taken_ml is null or fluid_taken_ml >= 0),
  check (fluid_offered_ml is null or fluid_taken_ml is null or fluid_taken_ml <= fluid_offered_ml)
);

create index if not exists food_fluid_entries_organisation_patient_idx
  on food_fluid_entries (organisation_id, patient_id, recorded_at desc);
