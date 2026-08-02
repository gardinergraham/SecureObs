alter table billing_accounts
  add column if not exists billing_address_line_1 text,
  add column if not exists billing_address_line_2 text,
  add column if not exists billing_city text,
  add column if not exists billing_county text,
  add column if not exists billing_postcode text,
  add column if not exists billing_country text;
