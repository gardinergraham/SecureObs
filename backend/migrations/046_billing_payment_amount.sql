alter table billing_accounts
  add column if not exists last_payment_amount integer,
  add column if not exists billing_currency text not null default 'gbp';

alter table billing_accounts drop constraint if exists billing_accounts_last_payment_amount_check;
alter table billing_accounts add constraint billing_accounts_last_payment_amount_check
  check (last_payment_amount is null or last_payment_amount >= 0);
