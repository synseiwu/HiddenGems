-- Hidden Gems video engagement stats, view tracking, admin view controls, and safe listing stats.
-- Run after previous migrations.

create table if not exists public.engagement_settings (
  id boolean primary key default true,
  show_likes boolean not null default true,
  show_dislikes boolean not null default true,
  show_views boolean not null default true,
  show_comments boolean not null default true,
  show_stats_on_cards boolean not null default true,
  show_stats_on_details boolean not null default true,
  show_stats_on_homepage boolean not null default true,
  view_tracking_enabled boolean not null default true,
  view_cooldown_minutes integer not null default 60 check (view_cooldown_minutes >= 1),
  compact_counts boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint engagement_settings_singleton check (id = true)
);

insert into public.engagement_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.video_views (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  viewer_key text,
  created_at timestamptz not null default now()
);

create index if not exists video_views_video_id_created_at_idx on public.video_views(video_id, created_at desc);
create index if not exists video_views_user_id_created_at_idx on public.video_views(user_id, created_at desc);

create table if not exists public.video_stat_overrides (
  video_id uuid primary key references public.videos(id) on delete cascade,
  view_count_adjustment integer not null default 0,
  manual_view_count integer,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.engagement_settings enable row level security;
alter table public.video_views enable row level security;
alter table public.video_stat_overrides enable row level security;

drop policy if exists "Authenticated read engagement settings" on public.engagement_settings;
drop policy if exists "Admins manage engagement settings" on public.engagement_settings;
drop policy if exists "Users insert own video views" on public.video_views;
drop policy if exists "Admins read video views" on public.video_views;
drop policy if exists "Admins manage video stat overrides" on public.video_stat_overrides;

create policy "Authenticated read engagement settings"
on public.engagement_settings
for select
to authenticated
using (true);

create policy "Admins manage engagement settings"
on public.engagement_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users insert own video views"
on public.video_views
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Admins read video views"
on public.video_views
for select
to authenticated
using (public.is_admin());

create policy "Admins manage video stat overrides"
on public.video_stat_overrides
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Safe aggregate stats for videos. No external links are exposed.
drop view if exists public.video_stats_safe;
create view public.video_stats_safe
with (security_invoker = false)
as
select
  v.id as video_id,
  coalesce(count(distinct vr.user_id) filter (where vr.reaction = 'like'), 0)::integer as like_count,
  coalesce(count(distinct vr.user_id) filter (where vr.reaction = 'dislike'), 0)::integer as dislike_count,
  coalesce(count(distinct vc.id) filter (where vc.approved = true), 0)::integer as comment_count,
  coalesce(
    max(vso.manual_view_count),
    greatest(0, count(distinct vv.id)::integer + coalesce(max(vso.view_count_adjustment), 0))
  )::integer as view_count
from public.videos v
left join public.video_reactions vr on vr.video_id = v.id
left join public.video_comments vc on vc.video_id = v.id
left join public.video_views vv on vv.video_id = v.id
left join public.video_stat_overrides vso on vso.video_id = v.id
group by v.id;

grant select on public.video_stats_safe to authenticated;

-- Recreate safe video listing view with engagement stats included.
drop view if exists public.videos_safe;
create view public.videos_safe
with (security_invoker = false)
as
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
  v.updated_at,
  coalesce(vs.like_count, 0) as like_count,
  coalesce(vs.dislike_count, 0) as dislike_count,
  coalesce(vs.comment_count, 0) as comment_count,
  coalesce(vs.view_count, 0) as view_count
from public.videos v
left join public.categories c on c.id = v.category_id
left join public.video_stats_safe vs on vs.video_id = v.id
where v.published = true;

grant select on public.videos_safe to authenticated;
revoke all on public.videos_safe from anon;

-- Recreate homepage safe view with dislike/view stats too.
drop view if exists public.homepage_showcase_rows_public;
create view public.homepage_showcase_rows_public
with (security_invoker = false)
as
with row_categories as (
  select
    r.id as row_id,
    coalesce(array_agg(rc.category_id order by rc.sort_order) filter (where rc.category_id is not null), '{}') as category_ids,
    coalesce(array_agg(c.name order by rc.sort_order) filter (where c.name is not null), '{}') as category_names
  from public.homepage_showcase_rows r
  left join public.homepage_showcase_row_categories rc on rc.row_id = r.id
  left join public.categories c on c.id = rc.category_id
  group by r.id
),
row_videos as (
  select
    r.id as row_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'title', v.title,
          'description', v.description,
          'category_id', v.category_id,
          'category_name', c.name,
          'price_cents', v.price_cents,
          'point_cost', v.point_cost,
          'thumbnail_url', v.thumbnail_url,
          'preview_url', v.preview_url,
          'access_type', v.access_type,
          'published', v.published,
          'created_at', v.created_at,
          'updated_at', v.updated_at,
          'like_count', coalesce(vs.like_count, 0),
          'dislike_count', coalesce(vs.dislike_count, 0),
          'comment_count', coalesce(vs.comment_count, 0),
          'view_count', coalesce(vs.view_count, 0)
        )
        order by
          case when r.sort_mode = 'oldest' then v.created_at end asc,
          case when r.sort_mode = 'most_liked' then coalesce(vs.like_count, 0) end desc,
          case when r.sort_mode = 'most_commented' then coalesce(vs.comment_count, 0) end desc,
          v.created_at desc
      ) filter (where v.id is not null),
      '[]'::jsonb
    ) as videos
  from public.homepage_showcase_rows r
  left join row_categories rcats on rcats.row_id = r.id
  left join public.videos v
    on v.published = true
    and (
      coalesce(array_length(rcats.category_ids, 1), 0) = 0
      or v.category_id = any(rcats.category_ids)
    )
  left join public.categories c on c.id = v.category_id
  left join public.video_stats_safe vs on vs.video_id = v.id
  where r.active = true
  group by r.id
)
select
  r.id,
  r.title,
  r.subtitle,
  r.layout_type,
  r.sort_order,
  r.max_items,
  r.sort_mode,
  rc.category_ids,
  case
    when coalesce(array_length(rc.category_names, 1), 0) = 0 then array['Recently Uploaded']
    else rc.category_names
  end as category_names,
  (
    select coalesce(jsonb_agg(item), '[]'::jsonb)
    from (
      select item
      from jsonb_array_elements(coalesce(rv.videos, '[]'::jsonb)) as item
      limit r.max_items
    ) limited
  ) as videos
from public.homepage_showcase_rows r
left join row_categories rc on rc.row_id = r.id
left join row_videos rv on rv.row_id = r.id
where r.active = true
order by r.sort_order asc, r.created_at asc;

grant select on public.homepage_showcase_rows_public to authenticated;

-- Admin stats view.
drop view if exists public.admin_video_stats;
create view public.admin_video_stats
with (security_invoker = false)
as
select
  v.id,
  v.title,
  v.access_type,
  v.published,
  v.created_at,
  c.name as category_name,
  coalesce(vs.like_count, 0) as like_count,
  coalesce(vs.dislike_count, 0) as dislike_count,
  coalesce(vs.comment_count, 0) as comment_count,
  coalesce(vs.view_count, 0) as view_count,
  coalesce(vso.view_count_adjustment, 0) as view_count_adjustment,
  vso.manual_view_count
from public.videos v
left join public.categories c on c.id = v.category_id
left join public.video_stats_safe vs on vs.video_id = v.id
left join public.video_stat_overrides vso on vso.video_id = v.id;

grant select on public.admin_video_stats to authenticated;

create or replace function public.track_video_view(target_video_id uuid)
returns table (
  tracked boolean,
  view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings public.engagement_settings%rowtype;
  recent_view timestamptz;
  current_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into settings from public.engagement_settings where id = true;

  if not coalesce(settings.view_tracking_enabled, true) then
    select coalesce(vs.view_count, 0) into current_count from public.video_stats_safe vs where vs.video_id = target_video_id;
    return query select false, coalesce(current_count, 0);
    return;
  end if;

  if not exists (select 1 from public.videos v where v.id = target_video_id and v.published = true) then
    raise exception 'Video is not available';
  end if;

  select max(vv.created_at)
  into recent_view
  from public.video_views vv
  where vv.video_id = target_video_id
  and vv.user_id = current_user_id;

  if recent_view is not null
    and recent_view > now() - make_interval(mins => coalesce(settings.view_cooldown_minutes, 60)) then
    select coalesce(vs.view_count, 0) into current_count from public.video_stats_safe vs where vs.video_id = target_video_id;
    return query select false, coalesce(current_count, 0);
    return;
  end if;

  insert into public.video_views (video_id, user_id, viewer_key)
  values (target_video_id, current_user_id, current_user_id::text);

  select coalesce(vs.view_count, 0) into current_count from public.video_stats_safe vs where vs.video_id = target_video_id;

  return query select true, coalesce(current_count, 0);
end;
$$;

create or replace function public.admin_set_video_view_count(target_video_id uuid, new_view_count integer)
returns table (
  video_id uuid,
  view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_count integer := greatest(0, coalesce(new_view_count, 0));
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.video_stat_overrides (video_id, manual_view_count, view_count_adjustment, updated_by, updated_at)
  values (target_video_id, safe_count, 0, auth.uid(), now())
  on conflict (video_id) do update
    set manual_view_count = excluded.manual_view_count,
        view_count_adjustment = 0,
        updated_by = auth.uid(),
        updated_at = now();

  return query select target_video_id, safe_count;
end;
$$;

create or replace function public.admin_adjust_video_view_count(target_video_id uuid, adjustment_amount integer)
returns table (
  video_id uuid,
  view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer := 0;
  new_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select coalesce(vs.view_count, 0)
  into current_count
  from public.video_stats_safe vs
  where vs.video_id = target_video_id;

  new_count := greatest(0, current_count + coalesce(adjustment_amount, 0));

  insert into public.video_stat_overrides (video_id, manual_view_count, view_count_adjustment, updated_by, updated_at)
  values (target_video_id, new_count, 0, auth.uid(), now())
  on conflict (video_id) do update
    set manual_view_count = excluded.manual_view_count,
        view_count_adjustment = 0,
        updated_by = auth.uid(),
        updated_at = now();

  return query select target_video_id, new_count;
end;
$$;

grant execute on function public.track_video_view(uuid) to authenticated;
grant execute on function public.admin_set_video_view_count(uuid, integer) to authenticated;
grant execute on function public.admin_adjust_video_view_count(uuid, integer) to authenticated;
