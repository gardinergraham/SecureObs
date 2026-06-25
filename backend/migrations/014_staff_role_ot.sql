alter table staff_members
  drop constraint if exists staff_members_role_check;

alter table staff_members
  add constraint staff_members_role_check
  check (role in ('nurse', 'hcf', 'ot', 'security', 'manager', 'doctor', 'super_admin'));
