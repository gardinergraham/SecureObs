alter table staff_members
  add column if not exists employment_type text not null default 'permanent',
  add column if not exists access_expires_at timestamptz,
  add column if not exists login_pin text;

create index if not exists staff_members_access_expires_at_idx
  on staff_members (access_expires_at);
