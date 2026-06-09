-- Hidden Gems homepage showcase fix: allow "Recently Uploaded" rows.
-- Run after 012_homepage_showcase_rows.sql.
-- A showcase row with no selected categories now displays newest videos from all categories.

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
video_stats as (
  select
    v.id as video_id,
    count(distinct vr.user_id) filter (where vr.reaction = 'like') as like_count,
    count(distinct vc.id) filter (where vc.approved = true) as comment_count
  from public.videos v
  left join public.video_reactions vr on vr.video_id = v.id
  left join public.video_comments vc on vc.video_id = v.id
  group by v.id
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
          'comment_count', coalesce(vs.comment_count, 0)
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
  left join video_stats vs on vs.video_id = v.id
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

-- Optional default row. It will not duplicate if one already exists with this title.
insert into public.homepage_showcase_rows (
  title,
  subtitle,
  layout_type,
  sort_order,
  max_items,
  sort_mode,
  active
)
select
  'Recently Uploaded',
  'Fresh videos added to Hidden Gems.',
  'horizontal',
  1,
  10,
  'newest',
  true
where not exists (
  select 1
  from public.homepage_showcase_rows
  where lower(title) = 'recently uploaded'
);
