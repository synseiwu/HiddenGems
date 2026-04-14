-- Hidden Gems PayPal checkout schema
-- Run this in the Supabase SQL editor before deploying the Edge Function.

alter table if exists public.profiles
  add column if not exists is_vip boolean not null default false,
  add column if not exists role text not null default 'guest';

create table if not exists public.hg_payment_transactions (
  id bigserial primary key,
  provider text not null default 'paypal',
  order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  payment_kind text not null,
  pack_id text,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  vip_granted boolean not null default false,
  status text not null default 'captured',
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hg_payment_transactions_user_id_idx on public.hg_payment_transactions(user_id);
create index if not exists hg_payment_transactions_kind_idx on public.hg_payment_transactions(payment_kind);

alter table public.hg_payment_transactions enable row level security;

do $$ begin
  create policy "hg_payment_transactions_select_own" on public.hg_payment_transactions
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_payment_transactions_insert_none" on public.hg_payment_transactions
    for insert with check (false);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_payment_transactions_update_none" on public.hg_payment_transactions
    for update using (false) with check (false);
exception when duplicate_object then null; end $$;
