alter table wards
  add column if not exists rota_shift_count integer not null default 3,
  add column if not exists rota_shifts jsonb not null default '[
    {"id":"shift-1","startsAt":"07:00","endsAt":"15:00"},
    {"id":"shift-2","startsAt":"15:00","endsAt":"23:00"},
    {"id":"shift-3","startsAt":"23:00","endsAt":"07:00"}
  ]'::jsonb,
  add column if not exists break_duration_minutes integer not null default 30;
