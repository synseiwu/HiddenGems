-- Hidden Gems VIP tier expansion + admin settings/security hardening.
-- Run after 004_age_gate_login_starter_bonus.sql.

create extension if not exists pgcrypto;

-- Profiles now track tier name/rank in addition to legacy vip_status.
alter table public.profiles
  add column if not exists subscription_tier text not null default 'none',
  add column if not exists vip_rank integer not null default 0 check (vip_rank >= 0);

update public.profiles
set subscription_tier = case when vip_status = true and subscription_tier = 'none' then 'vip' else subscription_tier end,
    vip_rank = case when vip_status = true and vip_rank = 0 then 1 else vip_rank end,
    updated_at = now();

create table if not exists public.vip_tiers (
  tier_key text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  stripe_price_id text unique,
  tier_rank integer not null check (tier_rank > 0),
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.vip_tiers (tier_key, name, description, price_cents, stripe_price_id, tier_rank, features, active, sort_order)
values
  ('vip', 'VIP', 'Base VIP vault access.', 1999, null, 1, array['VIP vault releases', 'Verified subscription access', 'Includes VIP-only videos'], true, 1),
  ('supervip', 'Super VIP', 'Expanded vault access for higher-tier releases.', 2999, null, 2, array['Includes VIP access', 'Super VIP vault releases', 'Higher-tier drops'], true, 2),
  ('ultravip', 'Ultra VIP', 'Highest vault tier for premium releases.', 4999, null, 3, array['Includes VIP and Super VIP', 'Ultra VIP vault releases', 'Highest-tier drops'], true, 3)
on conflict (tier_key) do update set
  name = excluded.name,
  description = coalesce(public.vip_tiers.description, excluded.description),
  tier_rank = excluded.tier_rank,
  features = case when public.vip_tiers.features = '{}' then excluded.features else public.vip_tiers.features end,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.vip_subscriptions
  add column if not exists tier_key text references public.vip_tiers(tier_key) on delete set null,
  add column if not exists stripe_price_id text,
  add column if not exists current_period_end timestamptz;

update public.vip_subscriptions
set tier_key = coalesce(tier_key, 'vip')
where tier_key is null;

-- Support new access levels on videos.
alter table public.videos drop constraint if exists videos_access_type_check;
alter table public.videos add constraint videos_access_type_check
  check (access_type in ('points', 'vip', 'supervip', 'ultravip', 'free', 'paid', 'admin_only'));

update public.videos set access_type = 'points' where access_type = 'paid';

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  public_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.vip_tiers enable row level security;
alter table public.site_settings enable row level security;
alter table public.security_events enable row level security;

-- Clean up old/conflicting policies before recreating.
drop policy if exists "Anyone can read active vip tiers" on public.vip_tiers;
drop policy if exists "Admins manage vip tiers" on public.vip_tiers;
drop policy if exists "Public can read public site settings" on public.site_settings;
drop policy if exists "Admins manage site settings" on public.site_settings;
drop policy if exists "Admins read security events" on public.security_events;
drop policy if exists "Admins manage security events" on public.security_events;

create policy "Anyone can read active vip tiers" on public.vip_tiers
for select using (active = true or public.is_admin());

create policy "Admins manage vip tiers" on public.vip_tiers
for all using (public.is_admin()) with check (public.is_admin());

create policy "Public can read public site settings" on public.site_settings
for select using (public_read = true or public.is_admin());

create policy "Admins manage site settings" on public.site_settings
for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins read security events" on public.security_events
for select using (public.is_admin());

create policy "Admins manage security events" on public.security_events
for all using (public.is_admin()) with check (public.is_admin());

-- Stronger full-video table protection. Normal users must use safe view + RPC.
drop policy if exists "Anyone can read published safe video rows" on public.videos;
drop policy if exists "Admins read full videos" on public.videos;
create policy "Admins read full videos" on public.videos for select using (public.is_admin());

-- Rebuild safe view without protected full external links.
drop view if exists public.videos_safe;
create view public.videos_safe with (security_invoker = true) as
select
  v.id,
  v.title,
  v.description,
  v.category_id,
  c.name as category_name,
  v.price_cents,
  v.point_cost,
  v.thumbnail_url,
  v.preview_url,
  v.access_type,
  v.published,
  v.created_at,
  v.updated_at
from public.videos v
left join public.categories c on c.id = v.category_id;

grant select on public.videos_safe to anon, authenticated;

create or replace function public.access_rank_for_type(access_type text)
returns integer
language sql
stable
as $$
  select case access_type
    when 'vip' then 1
    when 'supervip' then 2
    when 'ultravip' then 3
    when 'admin_only' then 99
    else 0
  end;
$$;

create or replace function public.get_my_vip_rank()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.vip_rank, case when p.vip_status then 1 else 0 end, 0)
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.user_has_video_access(target_user_id uuid, target_video_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.videos v
    left join public.profiles p on p.id = target_user_id
    where v.id = target_video_id
      and v.published = true
      and (
        (select role from public.profiles where id = target_user_id) = 'admin'
        or v.access_type = 'free'
        or exists (select 1 from public.purchases pur where pur.video_id = v.id and pur.user_id = target_user_id)
        or (
          public.access_rank_for_type(v.access_type) between 1 and 98
          and coalesce(p.vip_rank, case when p.vip_status then 1 else 0 end, 0) >= public.access_rank_for_type(v.access_type)
        )
      )
  );
$$;

drop function if exists public.get_unlocked_video(uuid);
create function public.get_unlocked_video(target_video_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  category_name text,
  price_cents integer,
  point_cost integer,
  thumbnail_url text,
  access_type text,
  external_video_link text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.title, v.description, c.name, v.price_cents, v.point_cost, v.thumbnail_url, v.access_type, v.external_video_link
  from public.videos v
  left join public.categories c on c.id = v.category_id
  where v.id = target_video_id
    and v.published = true
    and auth.uid() is not null
    and public.user_has_video_access(auth.uid(), v.id);
$$;

drop function if exists public.get_my_library();
create function public.get_my_library()
returns table (
  video_id uuid,
  title text,
  description text,
  thumbnail_url text,
  external_video_link text,
  purchased_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.title, v.description, v.thumbnail_url, v.external_video_link, pur.purchased_at
  from public.purchases pur
  join public.videos v on v.id = pur.video_id
  where pur.user_id = auth.uid() and v.published = true
  union
  select v.id, v.title, v.description, v.thumbnail_url, v.external_video_link, null::timestamptz
  from public.videos v
  where v.published = true
    and auth.uid() is not null
    and public.user_has_video_access(auth.uid(), v.id)
    and public.access_rank_for_type(v.access_type) between 1 and 98;
$$;

-- Server-side only helper. Edge Functions call this with service role after verifying auth.
drop function if exists public.unlock_video_with_points(uuid, uuid);
create function public.unlock_video_with_points(target_user_id uuid, target_video_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  video_record public.videos%rowtype;
  current_balance integer;
  already_unlocked boolean;
begin
  select * into video_record
  from public.videos
  where id = target_video_id and published = true;

  if not found then
    insert into public.security_events (user_id, event_type, details)
    values (target_user_id, 'failed_unlock', jsonb_build_object('reason', 'video_not_available', 'video_id', target_video_id));
    raise exception 'Video is not available';
  end if;

  if public.access_rank_for_type(video_record.access_type) > 0 then
    insert into public.security_events (user_id, event_type, details)
    values (target_user_id, 'failed_unlock', jsonb_build_object('reason', 'tier_video_points_unlock_blocked', 'video_id', target_video_id, 'access_type', video_record.access_type));
    raise exception 'This video requires subscription tier access';
  end if;

  select exists (
    select 1 from public.purchases where user_id = target_user_id and video_id = target_video_id
  ) into already_unlocked;

  if already_unlocked then
    return jsonb_build_object('status', 'already_unlocked', 'points_balance', (select points_balance from public.user_wallets where user_id = target_user_id));
  end if;

  insert into public.user_wallets (user_id, points_balance)
  values (target_user_id, 0)
  on conflict (user_id) do nothing;

  select points_balance into current_balance
  from public.user_wallets
  where user_id = target_user_id
  for update;

  if video_record.access_type <> 'free' and current_balance < video_record.point_cost then
    insert into public.security_events (user_id, event_type, details)
    values (target_user_id, 'failed_unlock', jsonb_build_object('reason', 'not_enough_points', 'video_id', target_video_id, 'cost', video_record.point_cost, 'balance', current_balance));
    raise exception 'Not enough points';
  end if;

  if video_record.access_type <> 'free' then
    update public.user_wallets
    set points_balance = points_balance - video_record.point_cost,
        updated_at = now()
    where user_id = target_user_id;

    insert into public.point_transactions (user_id, amount, transaction_type, description, video_id)
    values (target_user_id, -video_record.point_cost, 'spend', 'Unlocked video with points', target_video_id);
  end if;

  insert into public.purchases (user_id, video_id, payment_status, purchased_at)
  values (target_user_id, target_video_id, case when video_record.access_type = 'free' then 'free' else 'points' end, now())
  on conflict (user_id, video_id) do nothing;

  return jsonb_build_object(
    'status', 'unlocked',
    'points_balance', (select points_balance from public.user_wallets where user_id = target_user_id)
  );
end;
$$;

create or replace function public.admin_adjust_user_points(target_user_id uuid, adjustment_amount integer, adjustment_description text default 'Admin point adjustment')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.user_wallets (user_id, points_balance)
  values (target_user_id, 0)
  on conflict (user_id) do nothing;

  update public.user_wallets
  set points_balance = greatest(0, points_balance + adjustment_amount),
      updated_at = now()
  where user_id = target_user_id
  returning points_balance into new_balance;

  insert into public.point_transactions (user_id, amount, transaction_type, description)
  values (target_user_id, adjustment_amount, 'admin_adjustment', adjustment_description);

  return jsonb_build_object('points_balance', new_balance);
end;
$$;

grant execute on function public.get_my_vip_rank() to authenticated;
grant execute on function public.get_unlocked_video(uuid) to authenticated;
grant execute on function public.get_my_library() to authenticated;
grant execute on function public.admin_adjust_user_points(uuid, integer, text) to authenticated;
