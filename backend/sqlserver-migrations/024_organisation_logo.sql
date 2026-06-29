if col_length('dbo.organisation_settings', 'logo_data_uri') is null
begin
  alter table dbo.organisation_settings add logo_data_uri nvarchar(max) null;
end;
