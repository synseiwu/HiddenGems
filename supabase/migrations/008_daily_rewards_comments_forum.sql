-- Hidden Gems daily rewards, video comments/reactions, and forum/community system.
-- Run after previous migrations.

create extension if not exists pgcrypto;

create table if not exists public.reward_settings (
  id boolean primary key default true,
  rewards_enabled boolean not null default true,
  daily_user_points integer not null default 10 check (daily_user_points >= 0),
  daily_vip_points integer not null default 50 check (daily_vip_points >= 0),
  daily_supervip_points integer not null default 100 check (daily_supervip_points >= 0),
  daily_ultravip_points integer not null default 150 check (daily_ultravip_points >= 0),
  admin_daily_rewards_enabled boolean not null default false,
  admin_daily_points integer not null default 0 check (admin_daily_points >= 0),
  comments_enabled boolean not null default true,
  comment_rewards_enabled boolean not null default true,
  comment_reward_points integer not null default 10 check (comment_reward_points >= 0),
  min_comment_seconds integer not null default 20 check (min_comment_seconds >= 0),
  require_comment_approval boolean not null default false,
  forum_enabled boolean not null default true,
  daily_reward_message text not null default 'Daily reward claimed!',
  comment_reward_message text not null default 'Thanks for commenting!',
  updated_at timestamptz not null default now(),
  constraint reward_settings_singleton check (id = true)
);

insert into public.reward_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_type text not null check (claim_type in ('daily_login', 'daily_comment')),
  claim_date date not null default current_date,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, claim_type, claim_date)
);

create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_reactions (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (video_id, user_id)
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 3000),
  category text not null default 'General Discussion',
  pinned boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reward_settings enable row level security;
alter table public.reward_claims enable row level security;
alter table public.video_comments enable row level security;
alter table public.video_reactions enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_replies enable row level security;

drop policy if exists "Authenticated read reward settings" on public.reward_settings;
drop policy if exists "Admins manage reward settings" on public.reward_settings;
drop policy if exists "Users read own reward claims" on public.reward_claims;
drop policy if exists "Admins read reward claims" on public.reward_claims;
drop policy if exists "Users read visible video comments" on public.video_comments;
drop policy if exists "Users create own video comments" on public.video_comments;
drop policy if exists "Users delete own video comments" on public.video_comments;
drop policy if exists "Admins manage video comments" on public.video_comments;
drop policy if exists "Users read video reactions" on public.video_reactions;
drop policy if exists "Users manage own video reactions" on public.video_reactions;
drop policy if exists "Users read forum posts" on public.forum_posts;
drop policy if exists "Users create forum posts" on public.forum_posts;
drop policy if exists "Users delete own forum posts" on public.forum_posts;
drop policy if exists "Admins manage forum posts" on public.forum_posts;
drop policy if exists "Users read forum replies" on public.forum_replies;
drop policy if exists "Users create forum replies" on public.forum_replies;
drop policy if exists "Users delete own forum replies" on public.forum_replies;
drop policy if exists "Admins manage forum replies" on public.forum_replies;

create policy "Authenticated read reward settings" on public.reward_settings
for select to authenticated using (true);

create policy "Admins manage reward settings" on public.reward_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own reward claims" on public.reward_claims
for select to authenticated using (user_id = auth.uid());

create policy "Admins read reward claims" on public.reward_claims
for select to authenticated using (public.is_admin());

create policy "Users read visible video comments" on public.video_comments
for select to authenticated using (approved = true or user_id = auth.uid() or public.is_admin());

create policy "Users create own video comments" on public.video_comments
for insert to authenticated with check (user_id = auth.uid());

create policy "Users delete own video comments" on public.video_comments
for delete to authenticated using (user_id = auth.uid());

create policy "Admins manage video comments" on public.video_comments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read video reactions" on public.video_reactions
for select to authenticated using (true);

create policy "Users manage own video reactions" on public.video_reactions
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users read forum posts" on public.forum_posts
for select to authenticated using (true);

create policy "Users create forum posts" on public.forum_posts
for insert to authenticated with check (user_id = auth.uid());

create policy "Users delete own forum posts" on public.forum_posts
for delete to authenticated using (user_id = auth.uid());

create policy "Admins manage forum posts" on public.forum_posts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read forum replies" on public.forum_replies
for select to authenticated using (true);

create policy "Users create forum replies" on public.forum_replies
for insert to authenticated with check (user_id = auth.uid());

create policy "Users delete own forum replies" on public.forum_replies
for delete to authenticated using (user_id = auth.uid());

create policy "Admins manage forum replies" on public.forum_replies
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.current_user_daily_reward_points()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.role = 'admin' and s.admin_daily_rewards_enabled then s.admin_daily_points
    when p.role = 'admin' and not s.admin_daily_rewards_enabled then 0
    when coalesce(p.vip_rank, case when p.vip_status then 1 else 0 end, 0) >= 3 then s.daily_ultravip_points
    when coalesce(p.vip_rank, case when p.vip_status then 1 else 0 end, 0) = 2 then s.daily_supervip_points
    when coalesce(p.vip_rank, case when p.vip_status then 1 else 0 end, 0) = 1 then s.daily_vip_points
    else s.daily_user_points
  end
  from public.profiles p
  cross join public.reward_settings s
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.claim_daily_login_reward()
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
  reward_amount integer := 0;
  new_balance integer := 0;
  enabled boolean := true;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select rewards_enabled into enabled from public.reward_settings where id = true;
  if not coalesce(enabled, true) then
    select coalesce(points_balance, 0) into new_balance from public.user_wallets where user_id = current_user_id;
    return query select false, coalesce(new_balance, 0), 0;
    return;
  end if;

  insert into public.user_wallets (user_id, points_balance)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  reward_amount := coalesce(public.current_user_daily_reward_points(), 0);

  if reward_amount <= 0 then
    select coalesce(points_balance, 0) into new_balance from public.user_wallets where user_id = current_user_id;
    return query select false, coalesce(new_balance, 0), 0;
    return;
  end if;

  insert into public.reward_claims (user_id, claim_type, claim_date, points_awarded)
  values (current_user_id, 'daily_login', current_date, reward_amount)
  on conflict (user_id, claim_type, claim_date) do nothing;

  if not found then
    select points_balance into new_balance from public.user_wallets where user_id = current_user_id;
    return query select false, coalesce(new_balance, 0), 0;
    return;
  end if;

  update public.user_wallets
  set points_balance = points_balance + reward_amount,
      updated_at = now()
  where user_id = current_user_id
  returning points_balance into new_balance;

  insert into public.point_transactions (user_id, amount, transaction_type, description)
  values (current_user_id, reward_amount, 'admin_adjustment', 'Daily login reward: ' || reward_amount || ' points');

  return query select true, coalesce(new_balance, reward_amount), reward_amount;
end;
$$;

create or replace function public.submit_video_comment(target_video_id uuid, comment_body text)
returns table (
  comment_id uuid,
  reward_granted boolean,
  points_balance integer,
  reward_amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings public.reward_settings%rowtype;
  recent_comment timestamptz;
  inserted_id uuid;
  new_balance integer := 0;
  awarded boolean := false;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into settings from public.reward_settings where id = true;

  if not coalesce(settings.comments_enabled, true) then
    raise exception 'Comments are currently disabled';
  end if;

  if target_video_id is null or not exists (select 1 from public.videos where id = target_video_id and published = true) then
    raise exception 'Video is not available';
  end if;

  if trim(coalesce(comment_body, '')) = '' then
    raise exception 'Comment cannot be empty';
  end if;

  select max(created_at) into recent_comment
  from public.video_comments
  where user_id = current_user_id;

  if recent_comment is not null
    and recent_comment > now() - make_interval(secs => coalesce(settings.min_comment_seconds, 20)) then
    raise exception 'Please wait before posting another comment';
  end if;

  insert into public.video_comments (video_id, user_id, body, approved)
  values (target_video_id, current_user_id, trim(comment_body), not coalesce(settings.require_comment_approval, false))
  returning id into inserted_id;

  insert into public.user_wallets (user_id, points_balance)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  if coalesce(settings.comment_rewards_enabled, true) and coalesce(settings.comment_reward_points, 0) > 0 then
    insert into public.reward_claims (user_id, claim_type, claim_date, points_awarded)
    values (current_user_id, 'daily_comment', current_date, settings.comment_reward_points)
    on conflict (user_id, claim_type, claim_date) do nothing;

    if found then
      update public.user_wallets
      set points_balance = points_balance + settings.comment_reward_points,
          updated_at = now()
      where user_id = current_user_id
      returning points_balance into new_balance;

      insert into public.point_transactions (user_id, amount, transaction_type, description, video_id)
      values (current_user_id, settings.comment_reward_points, 'admin_adjustment', 'Daily comment reward: ' || settings.comment_reward_points || ' points', target_video_id);

      awarded := true;
    end if;
  end if;

  if not awarded then
    select coalesce(points_balance, 0) into new_balance
    from public.user_wallets
    where user_id = current_user_id;
  end if;

  return query select inserted_id, awarded, coalesce(new_balance, 0), case when awarded then settings.comment_reward_points else 0 end;
end;
$$;

create or replace function public.set_video_reaction(target_video_id uuid, reaction_value text)
returns table (
  likes integer,
  dislikes integer,
  my_reaction text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if reaction_value not in ('like', 'dislike') then
    raise exception 'Invalid reaction';
  end if;

  insert into public.video_reactions (video_id, user_id, reaction)
  values (target_video_id, current_user_id, reaction_value)
  on conflict (video_id, user_id) do update
    set reaction = excluded.reaction,
        updated_at = now();

  return query
  select
    count(*) filter (where reaction = 'like')::integer as likes,
    count(*) filter (where reaction = 'dislike')::integer as dislikes,
    (select reaction from public.video_reactions where video_id = target_video_id and user_id = current_user_id) as my_reaction
  from public.video_reactions
  where video_id = target_video_id;
end;
$$;

create or replace function public.get_video_reaction_summary(target_video_id uuid)
returns table (
  likes integer,
  dislikes integer,
  my_reaction text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where reaction = 'like')::integer as likes,
    count(*) filter (where reaction = 'dislike')::integer as dislikes,
    (select reaction from public.video_reactions where video_id = target_video_id and user_id = auth.uid()) as my_reaction
  from public.video_reactions
  where video_id = target_video_id;
$$;

grant execute on function public.claim_daily_login_reward() to authenticated;
grant execute on function public.submit_video_comment(uuid, text) to authenticated;
grant execute on function public.set_video_reaction(uuid, text) to authenticated;
grant execute on function public.get_video_reaction_summary(uuid) to authenticated;
grant execute on function public.current_user_daily_reward_points() to authenticated;
