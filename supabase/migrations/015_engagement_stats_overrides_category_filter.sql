-- Hidden Gems engagement stat override fix.
-- Run after 014_video_stats_view_counts_admin.sql.
-- Adds admin-friendly manual controls for likes, dislikes, and views.

alter table public.video_stat_overrides
  add column if not exists manual_like_count integer,
  add column if not exists manual_dislike_count integer;

-- Recreate video stats view so manual admin counts override real likes/dislikes/views.
drop view if exists public.admin_video_stats;
drop view if exists public.homepage_showcase_rows_public;
drop view if exists public.videos_safe;
drop view if exists public.video_stats_safe;

create view public.video_stats_safe
with (security_invoker = false)
as
select
  v.id as video_id,
  coalesce(
    max(vso.manual_like_count),
    count(distinct vr.user_id) filter (where vr.reaction = 'like')
  )::integer as like_count,
  coalesce(
    max(vso.manual_dislike_count),
    count(distinct vr.user_id) filter (where vr.reaction = 'dislike')
  )::integer as dislike_count,
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
  vso.manual_view_count,
  vso.manual_like_count,
  vso.manual_dislike_count
from public.videos v
left join public.categories c on c.id = v.category_id
left join public.video_stats_safe vs on vs.video_id = v.id
left join public.video_stat_overrides vso on vso.video_id = v.id;

grant select on public.admin_video_stats to authenticated;

create or replace function public.admin_set_video_engagement_stats(
  target_video_id uuid,
  new_like_count integer,
  new_dislike_count integer,
  new_view_count integer
)
returns table (
  video_id uuid,
  like_count integer,
  dislike_count integer,
  view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_likes integer := greatest(0, coalesce(new_like_count, 0));
  safe_dislikes integer := greatest(0, coalesce(new_dislike_count, 0));
  safe_views integer := greatest(0, coalesce(new_view_count, 0));
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.video_stat_overrides (
    video_id,
    manual_like_count,
    manual_dislike_count,
    manual_view_count,
    view_count_adjustment,
    updated_by,
    updated_at
  )
  values (
    target_video_id,
    safe_likes,
    safe_dislikes,
    safe_views,
    0,
    auth.uid(),
    now()
  )
  on conflict (video_id) do update
    set manual_like_count = excluded.manual_like_count,
        manual_dislike_count = excluded.manual_dislike_count,
        manual_view_count = excluded.manual_view_count,
        view_count_adjustment = 0,
        updated_by = auth.uid(),
        updated_at = now();

  return query select target_video_id, safe_likes, safe_dislikes, safe_views;
end;
$$;

create or replace function public.admin_adjust_video_engagement_stat(
  target_video_id uuid,
  stat_name text,
  adjustment_amount integer
)
returns table (
  video_id uuid,
  like_count integer,
  dislike_count integer,
  view_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_likes integer := 0;
  current_dislikes integer := 0;
  current_views integer := 0;
  next_likes integer := 0;
  next_dislikes integer := 0;
  next_views integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select
    coalesce(vs.like_count, 0),
    coalesce(vs.dislike_count, 0),
    coalesce(vs.view_count, 0)
  into current_likes, current_dislikes, current_views
  from public.video_stats_safe vs
  where vs.video_id = target_video_id;

  next_likes := current_likes;
  next_dislikes := current_dislikes;
  next_views := current_views;

  if stat_name = 'like_count' then
    next_likes := greatest(0, current_likes + coalesce(adjustment_amount, 0));
  elsif stat_name = 'dislike_count' then
    next_dislikes := greatest(0, current_dislikes + coalesce(adjustment_amount, 0));
  elsif stat_name = 'view_count' then
    next_views := greatest(0, current_views + coalesce(adjustment_amount, 0));
  else
    raise exception 'Invalid stat name';
  end if;

  insert into public.video_stat_overrides (
    video_id,
    manual_like_count,
    manual_dislike_count,
    manual_view_count,
    view_count_adjustment,
    updated_by,
    updated_at
  )
  values (
    target_video_id,
    next_likes,
    next_dislikes,
    next_views,
    0,
    auth.uid(),
    now()
  )
  on conflict (video_id) do update
    set manual_like_count = excluded.manual_like_count,
        manual_dislike_count = excluded.manual_dislike_count,
        manual_view_count = excluded.manual_view_count,
        view_count_adjustment = 0,
        updated_by = auth.uid(),
        updated_at = now();

  return query select target_video_id, next_likes, next_dislikes, next_views;
end;
$$;

grant execute on function public.admin_set_video_engagement_stats(uuid, integer, integer, integer) to authenticated;
grant execute on function public.admin_adjust_video_engagement_stat(uuid, text, integer) to authenticated;
