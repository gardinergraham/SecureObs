alter table patients
  add column if not exists date_of_birth date,
  add column if not exists next_of_kin_name text not null default '',
  add column if not exists next_of_kin_relationship text not null default '',
  add column if not exists next_of_kin_telephone text not null default '',
  add column if not exists next_of_kin_email text not null default '';
