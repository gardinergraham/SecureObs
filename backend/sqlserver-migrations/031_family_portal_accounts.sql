if object_id('dbo.family_portal_accounts', 'U') is null
begin
  create table dbo.family_portal_accounts (
    id uniqueidentifier not null primary key default newid(),
    organisation_id uniqueidentifier not null references dbo.organisations(id),
    patient_id nvarchar(255) not null references dbo.patients(id),
    contact_id nvarchar(255) not null,
    username nvarchar(255) not null,
    username_normalized nvarchar(255) not null,
    pin_hash nvarchar(500) null,
    activation_code_hash nvarchar(500) null,
    activation_expires_at datetimeoffset null,
    active bit not null default 1,
    failed_attempts int not null default 0,
    locked_until datetimeoffset null,
    token_version int not null default 1,
    last_login_at datetimeoffset null,
    created_by_staff_id nvarchar(255) null,
    created_by_staff_code nvarchar(255) null,
    created_at datetimeoffset not null default sysdatetimeoffset(),
    updated_at datetimeoffset not null default sysdatetimeoffset(),
    constraint family_portal_accounts_contact_uq unique (organisation_id, patient_id, contact_id),
    constraint family_portal_accounts_username_uq unique (username_normalized)
  );

  create index family_portal_accounts_patient_idx
    on dbo.family_portal_accounts (organisation_id, patient_id, active);

  create index family_portal_accounts_username_idx
    on dbo.family_portal_accounts (username_normalized, active);
end;
