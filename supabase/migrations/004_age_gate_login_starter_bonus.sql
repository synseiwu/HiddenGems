-- Hidden Gems account-only browsing + one-time 300 point starter bonus.
-- Run this after 003_categories_preview_cleanup.sql.

alter table public.profiles
  add column if not exists starter_bonus_awarded boolean not null default false;

-- Protect existing accounts from receiving the new-user starter bonus retroactively.
-- Only profiles created after this migration should receive the automatic first-login bonus.
update public.profiles
set starter_bonus_awarded = true,
    updated_at = now()
where starter_bonus_awarded = false;

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
    set email = excluded.email;

  insert into public.user_wallets (user_id, points_balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.claim_starter_bonus()
returns table (
  granted boolean,
  points_balance integer
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
    set email = coalesce(public.profiles.email, excluded.email);

  insert into public.user_wallets (user_id, points_balance)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select p.starter_bonus_awarded
  into already_awarded
  from public.profiles p
  where p.id = current_user_id
  for update;

  if already_awarded then
    select w.points_balance
    into new_balance
    from public.user_wallets w
    where w.user_id = current_user_id;

    return query select false, coalesce(new_balance, 0);
    return;
  end if;

  update public.user_wallets
  set points_balance = points_balance + 300,
      updated_at = now()
  where user_id = current_user_id
  returning public.user_wallets.points_balance into new_balance;

  insert into public.point_transactions (user_id, amount, transaction_type, description)
  values (current_user_id, 300, 'admin_adjustment', 'Starter bonus: 300 points');

  update public.profiles
  set starter_bonus_awarded = true,
      updated_at = now()
  where id = current_user_id;

  return query select true, coalesce(new_balance, 300);
end;
$$;

grant execute on function public.claim_starter_bonus() to authenticated;
