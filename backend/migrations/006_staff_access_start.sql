alter table staff_members
  add column if not exists access_starts_at timestamptz;

create index if not exists staff_members_access_starts_at_idx
  on staff_members (access_starts_at);
