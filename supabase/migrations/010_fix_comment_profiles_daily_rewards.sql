-- Hidden Gems fix: comments/forum schema relationship errors + daily reward check.
-- Run after 008/009 community migrations.

-- Make sure inserts can default to the current logged-in user.
alter table public.video_comments alter column user_id set default auth.uid();
alter table public.video_reactions alter column user_id set default auth.uid();
alter table public.forum_posts alter column user_id set default auth.uid();
alter table public.forum_replies alter column user_id set default auth.uid();

-- Create safe public views that join profiles manually.
-- This avoids PostgREST schema-cache relationship errors like:
-- "Could not find a relationship between video_comments and profiles".
drop view if exists public.video_comments_public;
create view public.video_comments_public
with (security_invoker = false)
as
select
  vc.id,
  vc.video_id,
  vc.user_id,
  vc.body,
  vc.approved,
  vc.created_at,
  vc.updated_at,
  p.email as author_email,
  split_part(coalesce(p.email, 'Hidden Gems user'), '@', 1) as author_name,
  p.role as author_role
from public.video_comments vc
left join public.profiles p on p.id = vc.user_id
where vc.approved = true or vc.user_id = auth.uid() or public.is_admin();

drop view if exists public.forum_posts_public;
create view public.forum_posts_public
with (security_invoker = false)
as
select
  fp.id,
  fp.user_id,
  fp.title,
  fp.body,
  fp.category,
  fp.pinned,
  fp.locked,
  fp.created_at,
  fp.updated_at,
  p.email as author_email,
  split_part(coalesce(p.email, 'Hidden Gems user'), '@', 1) as author_name,
  p.role as author_role
from public.forum_posts fp
left join public.profiles p on p.id = fp.user_id
where coalesce((select forum_enabled from public.reward_settings where id = true), true) or public.is_admin();

drop view if exists public.forum_replies_public;
create view public.forum_replies_public
with (security_invoker = false)
as
select
  fr.id,
  fr.post_id,
  fr.user_id,
  fr.body,
  fr.created_at,
  fr.updated_at,
  fp.title as post_title,
  p.email as author_email,
  split_part(coalesce(p.email, 'Hidden Gems user'), '@', 1) as author_name,
  p.role as author_role
from public.forum_replies fr
join public.forum_posts fp on fp.id = fr.post_id
left join public.profiles p on p.id = fr.user_id
where coalesce((select forum_enabled from public.reward_settings where id = true), true) or public.is_admin();

grant select on public.video_comments_public to authenticated;
grant select on public.forum_posts_public to authenticated;
grant select on public.forum_replies_public to authenticated;

-- Make sure the reward settings row exists and rewards are enabled.
insert into public.reward_settings (id)
values (true)
on conflict (id) do nothing;

update public.reward_settings
set
  rewards_enabled = true,
  daily_user_points = case when daily_user_points <= 0 then 10 else daily_user_points end,
  daily_vip_points = case when daily_vip_points <= 0 then 50 else daily_vip_points end,
  daily_supervip_points = case when daily_supervip_points <= 0 then 100 else daily_supervip_points end,
  daily_ultravip_points = case when daily_ultravip_points <= 0 then 150 else daily_ultravip_points end,
  comments_enabled = true,
  comment_rewards_enabled = true,
  comment_reward_points = case when comment_reward_points <= 0 then 10 else comment_reward_points end,
  forum_enabled = true,
  updated_at = now()
where id = true;

-- Recreate daily claim function using the allowed transaction_type in your database.
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

  reward_amount := coalesce(public.current_user_daily_reward_points(), 10);

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

grant execute on function public.claim_daily_login_reward() to authenticated;
