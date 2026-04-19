-- Hidden Gems PayPal checkout schema
-- Run this in the Supabase SQL editor before deploying the Edge Function.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  is_vip boolean not null default false,
  role text not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.profiles
  add column if not exists is_vip boolean not null default false,
  add column if not exists role text not null default 'guest',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.hg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hg_profiles_set_updated_at on public.profiles;
create trigger hg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.hg_set_updated_at();

create or replace function public.hg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_vip, role)
  values (new.id, new.email, false, 'guest')
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_hg on auth.users;
create trigger on_auth_user_created_hg
after insert on auth.users
for each row execute function public.hg_handle_new_user();

alter table public.profiles enable row level security;

do $$ begin
  create policy "profiles_select_own" on public.profiles
    for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_insert_own" on public.profiles
    for insert with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null; end $$;


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
