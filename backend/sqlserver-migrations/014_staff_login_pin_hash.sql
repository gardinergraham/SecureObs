if col_length('dbo.staff_members', 'login_pin_hash') is null
begin
  alter table dbo.staff_members add login_pin_hash nvarchar(500) null;
end;
