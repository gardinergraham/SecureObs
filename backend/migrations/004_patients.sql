create table if not exists patients (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_number integer not null,
  hospital_number text not null,
  first_name text not null,
  surname text not null,
  ward_id text not null references wards(id),
  room_number integer not null,
  observation_level text not null default 'Intermittent',
  latest_observation_place text not null default 'Side room',
  latest_observation_time timestamptz not null default now(),
  latest_observed_by text not null default '',
  latest_presentation text not null default 'Awake',
  on_off_ward text not null default 'On ward',
  seclusion boolean not null default false,
  long_term_seclusion boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists patients_organisation_ward_idx on patients (organisation_id, ward_id, archived, room_number);
create index if not exists patients_hospital_number_idx on patients (organisation_id, hospital_number);
