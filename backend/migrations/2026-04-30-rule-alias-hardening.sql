begin;

-- Ensure ledger scoping exists on account_aliases
alter table if exists public.account_aliases
  add column if not exists ledger_id uuid;

-- Add/normalize priority defaults
alter table if exists public.rules
  add column if not exists priority integer;

update public.rules
set priority = 1
where priority is null;

alter table if exists public.rules
  alter column priority set default 1;

alter table if exists public.account_aliases
  add column if not exists priority integer;

update public.account_aliases
set priority = 1
where priority is null;

alter table if exists public.account_aliases
  alter column priority set default 1;

-- Backfill account_aliases.ledger_id from accounts
update public.account_aliases aa
set ledger_id = a.ledger_id
from public.accounts a
where aa.account_id = a.id
  and aa.ledger_id is null;

-- Make ledger_id mandatory after backfill
alter table if exists public.account_aliases
  alter column ledger_id set not null;

-- Ledger-safe uniqueness constraints
create unique index if not exists ux_rules_ledger_keyword
  on public.rules (ledger_id, keyword);

create unique index if not exists ux_account_aliases_ledger_alias
  on public.account_aliases (ledger_id, alias);

-- Lookup indexes
create index if not exists ix_rules_ledger_priority
  on public.rules (ledger_id, priority desc);

create index if not exists ix_account_aliases_ledger_priority
  on public.account_aliases (ledger_id, priority desc);

commit;
