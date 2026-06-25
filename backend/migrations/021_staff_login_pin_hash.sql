alter table staff_members
  add column if not exists login_pin_hash text;
