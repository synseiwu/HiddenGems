-- Hidden Gems starter points fix.
-- Ensures every new confirmed/login user can securely claim 300 starter points once.
-- Run this after the previous migrations.

alter table public.profiles
  add column if not exists starter_bonus_awarded boolean not null default false;

-- Make sure required wallet / transaction tables exist in case older databases are missing them.
create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  transaction_type text not null,
  description text,
  video_id uuid null,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

-- New Auth users get a profile/wallet immediately. The starter bonus itself is still
-- claimed on first successful login through claim_starter_bonus(), so it can show the popup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, starter_bonus_awarded)
  values (new.id, new.email, 'user', false)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.user_wallets (user_id, points_balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.claim_starter_bonus()
returns table (
  granted boolean,
  points_balance integer,
  amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := coalesce(auth.jwt() ->> 'email', '');
  already_awarded boolean;
  new_balance integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, role, starter_bonus_awarded)
  values (current_user_id, current_email, 'user', false)
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        updated_at = now();

  insert into public.user_wallets (user_id, points_balance)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select p.starter_bonus_awarded
  into already_awarded
  from public.profiles p
  where p.id = current_user_id
  for update;

  if coalesce(already_awarded, false) then
    select w.points_balance
    into new_balance
    from public.user_wallets w
    where w.user_id = current_user_id;

    return query select false, coalesce(new_balance, 0), 0;
    return;
  end if;

  update public.user_wallets
  set points_balance = points_balance + 300,
      updated_at = now()
  where user_id = current_user_id
  returning public.user_wallets.points_balance into new_balance;

  insert into public.point_transactions (user_id, amount, transaction_type, description)
  values (current_user_id, 300, 'starter_bonus', 'Starter bonus: 300 points');

  update public.profiles
  set starter_bonus_awarded = true,
      updated_at = now()
  where id = current_user_id;

  return query select true, coalesce(new_balance, 300), 300;
end;
$$;

grant execute on function public.claim_starter_bonus() to authenticated;
