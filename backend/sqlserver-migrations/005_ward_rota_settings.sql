if col_length('dbo.wards', 'rota_shift_count') is null
begin
  alter table dbo.wards add rota_shift_count int not null default 3;
end;

if col_length('dbo.wards', 'rota_shifts') is null
begin
  alter table dbo.wards add rota_shifts nvarchar(max) not null default '[{"id":"shift-1","startsAt":"07:00","endsAt":"15:00"},{"id":"shift-2","startsAt":"15:00","endsAt":"23:00"},{"id":"shift-3","startsAt":"23:00","endsAt":"07:00"}]';
end;

if col_length('dbo.wards', 'break_duration_minutes') is null
begin
  alter table dbo.wards add break_duration_minutes int not null default 30;
end;
