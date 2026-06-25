alter table wards
  add column if not exists session_timeout_minutes integer not null default 15;
