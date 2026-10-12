-- Existing ward IDs retain all existing patient and staff access controls.
create table if not exists home_care_profiles (
 ward_id text primary key references wards(id),
 address text not null,
 access_notes text not null default '',
 emergency_contact text not null default '',
 care_summary text not null default '',
 required_carers integer not null default 1 check(required_carers between 1 and 10),
 continuous_cover boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists home_care_duties (
 id uuid primary key,
 ward_id text not null references home_care_profiles(ward_id),
 staff_id uuid not null references staff_members(id),
 kind text not null check(kind in ('day','waking_night','sleep_in','live_in','wellness')),
 starts_at timestamptz not null,
 ends_at timestamptz not null check(ends_at > starts_at),
 notes text not null default '',
 state text not null default 'planned' check(state in ('planned','present','break','completed','cancelled')),
 checked_in_at timestamptz,
 checked_out_at timestamptz,
 updated_at timestamptz not null default now(),
 created_by uuid not null references staff_members(id)
);
create index if not exists home_care_duties_location_time on home_care_duties(ward_id,starts_at,ends_at);
create unique index if not exists home_care_one_active_duty on home_care_duties(staff_id) where state in ('present','break');
create table if not exists home_care_events (
 id uuid primary key,
 duty_id uuid not null references home_care_duties(id),
 actor_id uuid not null references staff_members(id),
 action text not null,
 notes text not null default '',
 wellness_outcome text check(wellness_outcome in ('well','concern','no_answer')),
 recorded_at timestamptz not null default now()
);
create index if not exists home_care_events_duty_time on home_care_events(duty_id,recorded_at desc);
