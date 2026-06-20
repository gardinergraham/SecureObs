create extension if not exists pgcrypto;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id text primary key,
  organisation_id uuid references organisations(id),
  name text not null
);

create table if not exists wards (
  id text primary key,
  site_id text not null references sites(id),
  name text not null,
  service_type text not null,
  observation_interval_minutes integer not null default 15,
  news2_enabled boolean not null default true,
  enhanced_observations_enabled boolean not null default true,
  security_checks_enabled boolean not null default true,
  medication_chart_enabled boolean not null default true,
  staff_rota_enabled boolean not null default true
);

create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  key_number integer,
  staff_code text not null,
  display_name text not null,
  role text not null check (role in ('nurse', 'hcf', 'security', 'manager', 'doctor')),
  designation text,
  can_prescribe boolean not null default false,
  ward_id text references wards(id),
  allowed_site_ids text[] not null default '{}',
  allowed_ward_ids text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, staff_code)
);

create index if not exists staff_members_staff_code_lower_idx on staff_members (lower(staff_code));
create index if not exists staff_members_active_idx on staff_members (active);

insert into organisations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'SecureObs Demo')
on conflict (id) do nothing;

insert into sites (id, organisation_id, name)
values
  ('site-1', '00000000-0000-0000-0000-000000000001', 'Secure Hospital North'),
  ('site-2', '00000000-0000-0000-0000-000000000001', 'Secure Hospital South')
on conflict (id) do nothing;

insert into wards (id, site_id, name, service_type)
values
  ('ward-1', 'site-1', 'Ash Ward', 'High secure hospital'),
  ('ward-2', 'site-1', 'Birch Ward', 'High secure hospital'),
  ('ward-3', 'site-2', 'Cedar Ward', 'Medium secure hospital')
on conflict (id) do nothing;

insert into staff_members (
  organisation_id,
  key_number,
  staff_code,
  display_name,
  role,
  designation,
  can_prescribe,
  ward_id,
  allowed_site_ids,
  allowed_ward_ids
)
values
  ('00000000-0000-0000-0000-000000000001', 101, 'NurseA', 'Alex Nurse', 'nurse', null, false, 'ward-1', array['site-1'], array['ward-1', 'ward-2']),
  ('00000000-0000-0000-0000-000000000001', 207, 'MorganH', 'Morgan HCF', 'hcf', null, false, 'ward-1', array['site-1', 'site-2'], array['ward-1', 'ward-3']),
  ('00000000-0000-0000-0000-000000000001', 314, 'RileyM', 'Riley Ward Manager', 'manager', null, false, 'ward-2', array['site-1', 'site-2'], array['ward-1', 'ward-2', 'ward-3']),
  ('00000000-0000-0000-0000-000000000001', 901, 'PatelD', 'Dr Anita Patel', 'doctor', 'Prescriber', true, 'ward-1', array['site-1', 'site-2'], array['ward-1', 'ward-2', 'ward-3'])
on conflict (organisation_id, staff_code) do update set
  key_number = excluded.key_number,
  display_name = excluded.display_name,
  role = excluded.role,
  designation = excluded.designation,
  can_prescribe = excluded.can_prescribe,
  ward_id = excluded.ward_id,
  allowed_site_ids = excluded.allowed_site_ids,
  allowed_ward_ids = excluded.allowed_ward_ids,
  updated_at = now();
