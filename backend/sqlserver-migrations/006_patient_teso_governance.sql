if col_length('dbo.patients', 'enhanced_observation') is null
begin
  alter table dbo.patients add enhanced_observation nvarchar(max) null;
end;

if col_length('dbo.patients', 'teso_history') is null
begin
  alter table dbo.patients add teso_history nvarchar(max) not null default '[]';
end;
