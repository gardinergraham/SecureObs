declare @constraintName nvarchar(128);

select @constraintName = cc.name
from sys.check_constraints cc
join sys.columns c on c.object_id = cc.parent_object_id
where cc.parent_object_id = object_id('dbo.staff_members')
  and c.name = 'role'
  and cc.definition like '%doctor%';

if @constraintName is not null
begin
  exec('alter table dbo.staff_members drop constraint ' + quotename(@constraintName));
end;

alter table dbo.staff_members
  add constraint ck_staff_members_role
  check (role in ('nurse', 'hcf', 'ot', 'security', 'manager', 'doctor'));
