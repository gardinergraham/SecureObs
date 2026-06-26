alter table staff_members
  add column if not exists login_pin_must_change boolean not null default false;

update staff_members
set login_pin_hash = 'pbkdf2_sha256$120000$secureobs-default-pin$HKhTYmMyoApK0GJdJhAh9EBFnU4PhX1UbloCS2yBOmc',
    login_pin = null,
    login_pin_must_change = true,
    updated_at = now()
where employment_type = 'permanent'
  and role <> 'super_admin'
  and login_pin_hash is null
  and login_pin is null;
