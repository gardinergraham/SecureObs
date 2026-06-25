create table if not exists security_areas (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  ward_id text not null references wards(id),
  name text not null,
  frequency_minutes integer not null,
  requires_count boolean not null default false,
  category text not null default 'custom',
  frequency_type text not null default 'per_shift',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_areas_organisation_ward_idx on security_areas (organisation_id, ward_id);
create index if not exists security_areas_active_idx on security_areas (active);

insert into security_areas (
  id, organisation_id, ward_id, name, frequency_minutes, requires_count, category, frequency_type, active
)
values
  ('area-ward-1-cutlery', '00000000-0000-0000-0000-000000000001', 'ward-1', 'Cutlery checks', 360, true, 'cutlery', 'per_meal', true),
  ('area-ward-1-security', '00000000-0000-0000-0000-000000000001', 'ward-1', 'Ward security checks', 480, false, 'ward_security', 'per_shift', true),
  ('area-ward-1-level-1-patient-search', '00000000-0000-0000-0000-000000000001', 'ward-1', 'Level 1 patient checks', 10080, false, 'level_1_patient_search', 'weekly_ad_hoc', true),
  ('area-ward-1-room-locker-zone', '00000000-0000-0000-0000-000000000001', 'ward-1', 'Room / locker / zone checks', 480, false, 'level_1_room_locker_zone', 'per_shift', true)
on conflict (id) do nothing;
