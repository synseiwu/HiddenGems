-- Hidden Gems homepage showcase rows / featured category layout system.
-- Run after previous migrations.

create table if not exists public.homepage_showcase_rows (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  subtitle text,
  layout_type text not null default 'horizontal' check (layout_type in ('horizontal', 'grid', 'featured', 'compact')),
  sort_order integer not null default 1,
  max_items integer not null default 8 check (max_items between 1 and 24),
  sort_mode text not null default 'newest' check (sort_mode in ('newest', 'oldest', 'most_liked', 'most_commented')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_showcase_row_categories (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.homepage_showcase_rows(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique (row_id, category_id)
);

alter table public.homepage_showcase_rows enable row level security;
alter table public.homepage_showcase_row_categories enable row level security;

drop policy if exists "Users read active showcase rows" on public.homepage_showcase_rows;
drop policy if exists "Admins manage showcase rows" on public.homepage_showcase_rows;
drop policy if exists "Users read showcase row categories" on public.homepage_showcase_row_categories;
drop policy if exists "Admins manage showcase row categories" on public.homepage_showcase_row_categories;

create policy "Users read active showcase rows"
on public.homepage_showcase_rows
for select
to authenticated
using (active = true or public.is_admin());

create policy "Admins manage showcase rows"
on public.homepage_showcase_rows
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users read showcase row categories"
on public.homepage_showcase_row_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.homepage_showcase_rows r
    where r.id = row_id
    and (r.active = true or public.is_admin())
  )
);

create policy "Admins manage showcase row categories"
on public.homepage_showcase_row_categories
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace view public.category_video_counts
with (security_invoker = false)
as
select
  c.id,
  c.name,
  c.description,
  count(v.id) filter (where v.published = true) as published_count
from public.categories c
left join public.videos v on v.category_id = c.id
group by c.id, c.name, c.description;

grant select on public.category_video_counts to authenticated;

-- Admin view with category lists and empty-category warnings.
drop view if exists public.homepage_showcase_rows_admin;
create view public.homepage_showcase_rows_admin
with (security_invoker = false)
as
select
  r.id,
  r.title,
  r.subtitle,
  r.layout_type,
  r.sort_order,
  r.max_items,
  r.sort_mode,
  r.active,
  r.created_at,
  r.updated_at,
  coalesce(array_agg(c.id order by rc.sort_order) filter (where c.id is not null), '{}') as category_ids,
  coalesce(array_agg(c.name order by rc.sort_order) filter (where c.id is not null), '{}') as category_names,
  coalesce(array_agg(c.name order by rc.sort_order) filter (where c.id is not null and coalesce(cvc.published_count, 0) = 0), '{}') as categories_without_published
from public.homepage_showcase_rows r
left join public.homepage_showcase_row_categories rc on rc.row_id = r.id
left join public.categories c on c.id = rc.category_id
left join public.category_video_counts cvc on cvc.id = c.id
group by r.id;

grant select on public.homepage_showcase_rows_admin to authenticated;

-- Public homepage view. It returns active rows with safe video-listing JSON.
-- No protected external links are exposed here.
drop view if exists public.homepage_showcase_rows_public;
create view public.homepage_showcase_rows_public
with (security_invoker = false)
as
with row_categories as (
  select
    r.id as row_id,
    array_agg(rc.category_id order by rc.sort_order) as category_ids,
    array_agg(c.name order by rc.sort_order) as category_names
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
  left join public.homepage_showcase_row_categories rc on rc.row_id = r.id
  left join public.videos v on v.category_id = rc.category_id and v.published = true
  left join public.categories c on c.id = v.category_id
  left join (
    select
      v.id as video_id,
      count(distinct vr.user_id) filter (where vr.reaction = 'like') as like_count,
      count(distinct vc.id) filter (where vc.approved = true) as comment_count
    from public.videos v
    left join public.video_reactions vr on vr.video_id = v.id
    left join public.video_comments vc on vc.video_id = v.id
    group by v.id
  ) vs on vs.video_id = v.id
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
  rc.category_names,
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

-- Upgrade listCategories() queries by making counts available from a safe view.
-- Frontend listCategories() will read category_video_counts after this patch.
