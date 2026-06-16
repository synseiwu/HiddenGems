-- Username system for easier DMs + one-time reward bonuses.
-- Run after the DM inbox migration.

alter table public.profiles
  add column if not exists username text,
  add column if not exists username_normalized text,
  add column if not exists username_created_at timestamptz,
  add column if not exists username_updated_at timestamptz;

create unique index if not exists profiles_username_normalized_unique
on public.profiles(username_normalized)
where username_normalized is not null;

create table if not exists public.user_reward_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username_bonus_claimed boolean not null default false,
  username_bonus_claimed_at timestamptz null,
  hidden_gems_access_bonus_claimed boolean not null default false,
  hidden_gems_access_bonus_claimed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.messaging_settings
  add column if not exists require_username_on_login boolean not null default true,
  add column if not exists allow_username_skip boolean not null default false,
  add column if not exists username_bonus_enabled boolean not null default true,
  add column if not exists username_bonus_points integer not null default 100 check (username_bonus_points >= 0),
  add column if not exists hidden_gems_access_bonus_enabled boolean not null default true,
  add column if not exists hidden_gems_access_bonus_points integer not null default 100 check (hidden_gems_access_bonus_points >= 0),
  add column if not exists allow_dm_search_by_email boolean not null default false,
  add column if not exists allow_dm_search_by_username boolean not null default true,
  add column if not exists allow_username_changes boolean not null default false,
  add column if not exists username_change_cooldown_days integer not null default 30 check (username_change_cooldown_days >= 0);

-- Expand point transaction types for the two new one-time bonuses.
alter table public.point_transactions
  drop constraint if exists point_transactions_transaction_type_check;

alter table public.point_transactions
  add constraint point_transactions_transaction_type_check
  check (transaction_type in (
    'purchase',
    'spend',
    'refund',
    'admin_adjustment',
    'username_bonus',
    'hidden_gems_access_bonus'
  ));

create unique index if not exists point_transactions_once_per_bonus
on public.point_transactions(user_id, transaction_type)
where transaction_type in ('username_bonus', 'hidden_gems_access_bonus');

alter table public.user_reward_flags enable row level security;

drop policy if exists "Users read own reward flags" on public.user_reward_flags;
drop policy if exists "Admins read reward flags" on public.user_reward_flags;

create policy "Users read own reward flags"
on public.user_reward_flags
for select
to authenticated
using (user_id = auth.uid());

create policy "Admins read reward flags"
on public.user_reward_flags
for select
to authenticated
using (public.is_admin());

grant select on public.user_reward_flags to authenticated;

create or replace function public.normalize_username(username_input text)
returns text
language sql
immutable
as $$
  select lower(trim(username_input));
$$;

create or replace function public.create_system_dm(target_user_id uuid, message_title text, message_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation_id uuid;
begin
  if target_user_id is null or message_body is null or trim(message_body) = '' then
    return;
  end if;

  insert into public.dm_conversations (created_by, conversation_type, title, is_system)
  values (null, 'system', coalesce(message_title, 'System Message'), true)
  returning id into conversation_id;

  insert into public.dm_participants (conversation_id, user_id, role)
  values (conversation_id, target_user_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  insert into public.dm_messages (conversation_id, sender_id, sender_label, body, message_kind)
  values (conversation_id, null, 'System', message_body, 'system');
end;
$$;

create or replace function public.create_username(username_input text)
returns table (
  username text,
  points_awarded integer,
  points_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_username text := trim(username_input);
  normalized text := public.normalize_username(username_input);
  reward_amount integer := 100;
  bonus_enabled boolean := true;
  new_balance integer := 0;
  already_has_username boolean := false;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if normalized !~ '^[a-z0-9_.]{3,24}$' then
    raise exception 'Use 3-24 characters: letters, numbers, underscores, or dots.';
  end if;

  if normalized in ('admin', 'administrator', 'system', 'support', 'hidden gems', 'hidden_gems', 'ai', 'ai_studio', 'staff') then
    raise exception 'That username is reserved.';
  end if;

  select exists (
    select 1 from public.profiles p
    where p.id = current_user_id
      and p.username_normalized is not null
  ) into already_has_username;

  if already_has_username then
    raise exception 'Username is already created for this account.';
  end if;

  if exists (select 1 from public.profiles p where p.username_normalized = normalized and p.id <> current_user_id) then
    raise exception 'Username is already taken.';
  end if;

  update public.profiles
  set username = clean_username,
      username_normalized = normalized,
      username_created_at = coalesce(username_created_at, now()),
      username_updated_at = now(),
      updated_at = now()
  where id = current_user_id;

  insert into public.user_reward_flags (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select coalesce(ms.username_bonus_enabled, true), coalesce(ms.username_bonus_points, 100)
  into bonus_enabled, reward_amount
  from public.messaging_settings ms
  where ms.id = true;

  if bonus_enabled and reward_amount > 0 then
    insert into public.user_wallets (user_id, points_balance)
    values (current_user_id, 0)
    on conflict (user_id) do nothing;

    insert into public.point_transactions (user_id, amount, transaction_type, description)
    values (current_user_id, reward_amount, 'username_bonus', 'Username created bonus')
    on conflict do nothing;

    if found then
      update public.user_wallets
      set points_balance = points_balance + reward_amount,
          updated_at = now()
      where user_id = current_user_id
      returning user_wallets.points_balance into new_balance;

      update public.user_reward_flags
      set username_bonus_claimed = true,
          username_bonus_claimed_at = now(),
          updated_at = now()
      where user_id = current_user_id;

      perform public.create_system_dm(
        current_user_id,
        'Username bonus added',
        'Thanks for creating your username. ' || reward_amount || ' points have been added to your wallet.'
      );

      return query select clean_username, reward_amount, new_balance;
      return;
    end if;
  end if;

  select coalesce(w.points_balance, 0) into new_balance from public.user_wallets w where w.user_id = current_user_id;
  return query select clean_username, 0, coalesce(new_balance, 0);
end;
$$;

create or replace function public.update_username(username_input text)
returns table (username text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_username text := trim(username_input);
  normalized text := public.normalize_username(username_input);
  changes_allowed boolean := false;
  cooldown_days integer := 30;
  last_changed timestamptz;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(allow_username_changes, false), coalesce(username_change_cooldown_days, 30)
  into changes_allowed, cooldown_days
  from public.messaging_settings
  where id = true;

  if not changes_allowed then
    raise exception 'Username changes are currently disabled.';
  end if;

  if normalized !~ '^[a-z0-9_.]{3,24}$' then
    raise exception 'Use 3-24 characters: letters, numbers, underscores, or dots.';
  end if;

  select username_updated_at into last_changed
  from public.profiles
  where id = current_user_id;

  if last_changed is not null and last_changed > now() - make_interval(days => cooldown_days) then
    raise exception 'You must wait before changing your username again.';
  end if;

  if exists (select 1 from public.profiles p where p.username_normalized = normalized and p.id <> current_user_id) then
    raise exception 'Username is already taken.';
  end if;

  update public.profiles
  set username = clean_username,
      username_normalized = normalized,
      username_updated_at = now(),
      updated_at = now()
  where id = current_user_id;

  return query select clean_username;
end;
$$;

create or replace function public.claim_hidden_gems_access_bonus()
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
  reward_amount integer := 100;
  bonus_enabled boolean := true;
  new_balance integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_reward_flags (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select coalesce(ms.hidden_gems_access_bonus_enabled, true), coalesce(ms.hidden_gems_access_bonus_points, 100)
  into bonus_enabled, reward_amount
  from public.messaging_settings ms
  where ms.id = true;

  if not bonus_enabled or reward_amount <= 0 then
    select coalesce(w.points_balance, 0) into new_balance from public.user_wallets w where w.user_id = current_user_id;
    return query select false, coalesce(new_balance, 0), 0;
    return;
  end if;

  insert into public.user_wallets (user_id, points_balance)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  insert into public.point_transactions (user_id, amount, transaction_type, description)
  values (current_user_id, reward_amount, 'hidden_gems_access_bonus', 'Access Info Hidden Gems entry bonus')
  on conflict do nothing;

  if found then
    update public.user_wallets
    set points_balance = points_balance + reward_amount,
        updated_at = now()
    where user_id = current_user_id
    returning user_wallets.points_balance into new_balance;

    update public.user_reward_flags
    set hidden_gems_access_bonus_claimed = true,
        hidden_gems_access_bonus_claimed_at = now(),
        updated_at = now()
    where user_id = current_user_id;

    perform public.create_system_dm(
      current_user_id,
      'Access bonus added',
      'You successfully unlocked platform access through Access Info. ' || reward_amount || ' points have been added to your wallet.'
    );

    return query select true, new_balance, reward_amount;
    return;
  end if;

  select coalesce(w.points_balance, 0) into new_balance from public.user_wallets w where w.user_id = current_user_id;
  return query select false, coalesce(new_balance, 0), 0;
end;
$$;

-- Rebuild DM user directory so usernames power the DM search.
drop view if exists public.messaging_user_directory;
create view public.messaging_user_directory
with (security_invoker = false)
as
select
  p.id,
  p.email,
  p.username,
  p.username_normalized,
  coalesce('@' || p.username, split_part(coalesce(p.email, 'user'), '@', 1)) as display_name,
  p.role,
  coalesce(p.vip_rank, 0) as vip_rank,
  coalesce(p.subscription_tier, 'none') as subscription_tier
from public.profiles p
where p.id is not null;

-- Rebuild conversation list to prefer usernames over emails.
drop view if exists public.dm_conversations_for_user;
create view public.dm_conversations_for_user
with (security_invoker = false)
as
select
  viewer.user_id as viewer_user_id,
  c.id as conversation_id,
  c.conversation_type,
  c.title,
  c.is_system,
  c.created_at,
  c.updated_at,
  other_user.email as other_participant_email,
  other_user.username as other_participant_username,
  coalesce(c.title, '@' || other_user.username, other_user.email, 'Conversation') as display_title,
  last_msg.body as last_message_body,
  last_msg.created_at as last_message_at,
  count(unread.id)::integer as unread_count
from public.dm_participants viewer
join public.dm_conversations c on c.id = viewer.conversation_id
left join public.dm_participants other_participant
  on other_participant.conversation_id = c.id
  and other_participant.user_id <> viewer.user_id
left join public.profiles other_user on other_user.id = other_participant.user_id
left join lateral (
  select m.body, m.created_at
  from public.dm_messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) last_msg on true
left join public.dm_messages unread
  on unread.conversation_id = c.id
  and unread.created_at > coalesce(viewer.last_read_at, '1970-01-01'::timestamptz)
  and (unread.sender_id is null or unread.sender_id <> viewer.user_id)
where viewer.archived_at is null
group by
  viewer.user_id,
  c.id,
  c.conversation_type,
  c.title,
  c.is_system,
  c.created_at,
  c.updated_at,
  other_user.email,
  other_user.username,
  last_msg.body,
  last_msg.created_at;

grant select on public.messaging_user_directory to authenticated;
grant select on public.dm_conversations_for_user to authenticated;
grant execute on function public.create_username(text) to authenticated;
grant execute on function public.update_username(text) to authenticated;
grant execute on function public.claim_hidden_gems_access_bonus() to authenticated;

select pg_notify('pgrst', 'reload schema');

select
  to_regclass('public.user_reward_flags') as user_reward_flags,
  'profiles.username columns ready' as username_status,
  'username rewards ready' as reward_status;
