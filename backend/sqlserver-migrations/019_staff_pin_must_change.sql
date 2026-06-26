if col_length('dbo.staff_members', 'login_pin_must_change') is null
begin
  alter table dbo.staff_members add login_pin_must_change bit not null default 0;
end;

update dbo.staff_members
set login_pin_hash = 'pbkdf2_sha256$120000$secureobs-default-pin$HKhTYmMyoApK0GJdJhAh9EBFnU4PhX1UbloCS2yBOmc',
    login_pin = null,
    login_pin_must_change = 1,
    updated_at = sysdatetimeoffset()
where employment_type = 'permanent'
  and role <> 'super_admin'
  and login_pin_hash is null
  and login_pin is null;
