alter table wards
  add column if not exists landing_page text not null default 'overview';

alter table wards
  drop constraint if exists wards_landing_page_check;

alter table wards
  add constraint wards_landing_page_check
  check (landing_page in ('overview', 'observations'));
