-- Hidden Gems forum reliability + daily reward verification helpers.
-- Run after 008_daily_rewards_comments_forum.sql.

-- Let inserts safely default to the current logged-in user when the frontend omits user_id.
alter table public.forum_posts
  alter column user_id set default auth.uid();

alter table public.forum_replies
  alter column user_id set default auth.uid();

alter table public.video_comments
  alter column user_id set default auth.uid();

alter table public.video_reactions
  alter column user_id set default auth.uid();

-- Make sure the singleton settings row exists.
insert into public.reward_settings (id)
values (true)
on conflict (id) do nothing;

-- Make sure normal logged-in users can read/use forum records.
drop policy if exists "Users read forum posts" on public.forum_posts;
create policy "Users read forum posts" on public.forum_posts
for select to authenticated using (
  coalesce((select forum_enabled from public.reward_settings where id = true), true)
  or public.is_admin()
);

drop policy if exists "Users create forum posts" on public.forum_posts;
create policy "Users create forum posts" on public.forum_posts
for insert to authenticated with check (
  user_id = auth.uid()
  and coalesce((select forum_enabled from public.reward_settings where id = true), true)
);

drop policy if exists "Users read forum replies" on public.forum_replies;
create policy "Users read forum replies" on public.forum_replies
for select to authenticated using (
  coalesce((select forum_enabled from public.reward_settings where id = true), true)
  or public.is_admin()
);

drop policy if exists "Users create forum replies" on public.forum_replies;
create policy "Users create forum replies" on public.forum_replies
for insert to authenticated with check (
  user_id = auth.uid()
  and coalesce((select forum_enabled from public.reward_settings where id = true), true)
);

-- Keep daily rewards enabled with sane defaults.
update public.reward_settings
set
  rewards_enabled = coalesce(rewards_enabled, true),
  daily_user_points = coalesce(nullif(daily_user_points, 0), 10),
  daily_vip_points = coalesce(nullif(daily_vip_points, 0), 50),
  daily_supervip_points = coalesce(nullif(daily_supervip_points, 0), 100),
  daily_ultravip_points = coalesce(nullif(daily_ultravip_points, 0), 150),
  comments_enabled = coalesce(comments_enabled, true),
  comment_rewards_enabled = coalesce(comment_rewards_enabled, true),
  comment_reward_points = coalesce(nullif(comment_reward_points, 0), 10),
  forum_enabled = coalesce(forum_enabled, true),
  updated_at = now()
where id = true;

-- Admin-friendly helper to verify if daily rewards are configured and who claimed today.
create or replace view public.daily_reward_status_today as
select
  p.email,
  p.role,
  coalesce(p.subscription_tier, 'none') as subscription_tier,
  coalesce(p.vip_rank, case when p.vip_status then 1 else 0 end, 0) as vip_rank,
  coalesce(w.points_balance, 0) as points_balance,
  rc.claim_date,
  coalesce(rc.points_awarded, 0) as points_awarded_today,
  rc.created_at as claimed_at
from public.profiles p
left join public.user_wallets w on w.user_id = p.id
left join public.reward_claims rc
  on rc.user_id = p.id
  and rc.claim_type = 'daily_login'
  and rc.claim_date = current_date
order by p.created_at desc;

grant select on public.daily_reward_status_today to authenticated;
