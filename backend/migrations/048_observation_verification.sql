alter table observations
  add column if not exists verification_method text not null default 'none',
  add column if not exists verification_scanned_at timestamptz,
  add column if not exists visual_confirmation boolean not null default false,
  add column if not exists verification_exception_reason text not null default '';

alter table observations
  drop constraint if exists observations_verification_method_check;

alter table observations
  add constraint observations_verification_method_check check (
    verification_method in ('none', 'nfc_room', 'nfc_personal', 'qr_room', 'qr_personal', 'manual_exception')
  );
