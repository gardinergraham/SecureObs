create table if not exists observations (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null,
  observer_name text not null,
  source text not null,
  type text not null,
  location text not null,
  presentation text not null,
  comments text not null default '',
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists observations_organisation_patient_idx on observations (organisation_id, patient_id, observed_at desc);

create table if not exists security_checks (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  area_id text not null,
  check_name text not null,
  checked_by text not null,
  checked_at timestamptz not null,
  notes text not null default '',
  counted_total integer,
  created_at timestamptz not null default now()
);

create index if not exists security_checks_organisation_area_idx on security_checks (organisation_id, area_id, checked_at desc);

create table if not exists news2_readings (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null,
  recorded_at timestamptz not null,
  recorded_by text not null,
  respiration_rate integer not null,
  spo2 integer not null,
  spo2_scale text not null,
  on_oxygen boolean not null default false,
  systolic_bp integer not null,
  pulse integer not null,
  consciousness text not null,
  temperature numeric(4, 1) not null,
  total_score integer not null,
  created_at timestamptz not null default now()
);

create index if not exists news2_readings_organisation_patient_idx on news2_readings (organisation_id, patient_id, recorded_at desc);

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

create table if not exists medication_prescriptions (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null,
  drug_name text not null,
  dose text not null,
  route text not null,
  administration_times text[] not null default '{}',
  start_date timestamptz not null,
  stop_date timestamptz,
  additional_instructions text not null default '',
  prescribed_by text not null,
  prescribed_at timestamptz not null,
  discontinued_by text,
  discontinued_at timestamptz,
  discontinue_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_prescriptions_organisation_patient_idx on medication_prescriptions (organisation_id, patient_id);

create table if not exists medication_administrations (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  prescription_id text not null,
  patient_id text not null,
  scheduled_at timestamptz not null,
  status text not null,
  omission_code text,
  recorded_by text not null,
  recorded_at timestamptz not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists medication_administrations_organisation_prescription_idx on medication_administrations (organisation_id, prescription_id, scheduled_at);
