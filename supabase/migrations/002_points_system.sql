-- Hidden Gems points system migration
-- Run this after 001_initial_schema.sql.

create extension if not exists pgcrypto;

-- Videos now unlock primarily through points. Keep price_cents/stripe_price_id for backwards compatibility,
-- but the app uses point_cost and no longer needs per-video Stripe prices.
alter table public.videos add column if not exists point_cost integer not null default 300 check (point_cost >= 0);
alter table public.videos drop constraint if exists videos_access_type_check;
alter table public.videos add constraint videos_access_type_check check (access_type in ('points', 'vip', 'free', 'paid'));
update public.videos set access_type = 'points' where access_type = 'paid';
update public.videos set point_cost = coalesce(nullif(point_cost, 300), price_cents, 300) where point_cost is null or point_cost = 300;

create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  points_amount integer not null check (points_amount > 0),
  price_cents integer not null check (price_cents > 0),
  stripe_price_id text unique,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  transaction_type text not null check (transaction_type in ('purchase', 'spend', 'refund', 'admin_adjustment')),
  description text,
  video_id uuid references public.videos(id) on delete set null,
  point_package_id uuid references public.point_packages(id) on delete set null,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

alter table public.user_wallets enable row level security;
alter table public.point_packages enable row level security;
alter table public.point_transactions enable row level security;

create policy "Users read own wallet" on public.user_wallets for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage wallets" on public.user_wallets for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read active point packages" on public.point_packages for select using (active = true or public.is_admin());
create policy "Admins manage point packages" on public.point_packages for all using (public.is_admin()) with check (public.is_admin());

create policy "Users read own point transactions" on public.point_transactions for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage point transactions" on public.point_transactions for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;

  insert into public.user_wallets (user_id, points_balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

insert into public.user_wallets (user_id, points_balance)
select id, 0 from auth.users
on conflict (user_id) do nothing;

-- Lock down the full videos table so external_video_link is not readable by normal users.
drop policy if exists "Anyone can read published safe video rows" on public.videos;
drop policy if exists "Admins read full videos" on public.videos;
create policy "Admins read full videos" on public.videos for select using (public.is_admin());

drop view if exists public.videos_safe;
create view public.videos_safe as
select
  v.id,
  v.title,
  v.description,
  v.category_id,
  c.name as category_name,
  v.price_cents,
  v.point_cost,
  v.thumbnail_url,
  v.access_type,
  v.published,
  v.created_at,
  v.updated_at
from public.videos v
left join public.categories c on c.id = v.category_id;

grant select on public.videos_safe to anon, authenticated;

create or replace function public.get_my_wallet()
returns table (
  points_balance integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(w.points_balance, 0), w.updated_at
  from public.user_wallets w
  where w.user_id = auth.uid();
$$;

create or replace function public.get_unlocked_video(target_video_id uuid)
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
  left join public.profiles p on p.id = auth.uid()
  where v.id = target_video_id
    and v.published = true
    and (
      v.access_type = 'free'
      or exists (select 1 from public.purchases pur where pur.video_id = v.id and pur.user_id = auth.uid())
      or (v.access_type = 'vip' and p.vip_status = true)
      or public.is_admin()
    );
$$;

create or replace function public.get_my_library()
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
  where pur.user_id = auth.uid()
  union
  select v.id, v.title, v.description, v.thumbnail_url, v.external_video_link, null::timestamptz
  from public.videos v
  join public.profiles p on p.id = auth.uid()
  where p.vip_status = true and v.access_type = 'vip' and v.published = true;
$$;

-- Server-side only helper. Edge Functions call this with the service role after verifying user auth.
create or replace function public.unlock_video_with_points(target_user_id uuid, target_video_id uuid)
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
    raise exception 'Video is not available';
  end if;

  if video_record.access_type = 'vip' then
    raise exception 'This video requires VIP access';
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

-- Seed default point packs. Replace stripe_price_id values after creating matching Stripe one-time prices.
insert into public.point_packages (name, description, points_amount, price_cents, stripe_price_id, sort_order)
values
  ('Starter Pack', 'Good for a quick unlock.', 500, 500, null, 1),
  ('Gem Pack', 'Bonus points for regular browsing.', 1100, 1000, null, 2),
  ('Vault Pack', 'Best value for frequent unlocks.', 3000, 2500, null, 3),
  ('Elite Pack', 'Maximum points for serious supporters.', 6500, 5000, null, 4)
on conflict do nothing;
