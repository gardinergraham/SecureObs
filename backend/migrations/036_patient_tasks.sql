create table if not exists patient_tasks (
  id text primary key,
  organisation_id uuid not null references organisations(id),
  patient_id text not null references patients(id),
  ward_id text not null references wards(id),
  title text not null,
  details text not null default '',
  category text not null,
  priority text not null check (priority in ('green', 'amber', 'red')),
  status text not null check (status in ('open', 'accepted', 'completed', 'cancelled')),
  due_at timestamptz not null,
  recurrence text not null check (recurrence in ('none', 'every_shift', 'daily')),
  assigned_to_staff_id text,
  assigned_to_name text,
  assigned_role text,
  source_type text,
  source_id text,
  created_by_staff_id text not null,
  created_by_name text not null,
  created_by_staff_code text not null,
  created_at timestamptz not null,
  accepted_by_staff_id text,
  accepted_by_name text,
  accepted_at timestamptz,
  completion_notes text,
  completed_by_staff_id text,
  completed_by_name text,
  completed_at timestamptz,
  cancelled_by_staff_id text,
  cancelled_by_name text,
  cancelled_at timestamptz
);

create index if not exists patient_tasks_ward_status_due_idx
  on patient_tasks (organisation_id, ward_id, status, due_at);

create index if not exists patient_tasks_patient_due_idx
  on patient_tasks (organisation_id, patient_id, due_at desc);
