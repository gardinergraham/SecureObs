alter table patients
  add column if not exists allergies text not null default '',
  add column if not exists adverse_drug_reactions text not null default '';
