if object_id('dbo.organisation_settings', 'U') is null
begin
  create table dbo.organisation_settings (
    organisation_id uniqueidentifier not null primary key references dbo.organisations(id),
    nfc_staff_code_format nvarchar(255) not null default 'passcode={STAFFCODE}',
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset()
  );
end;
