-- Hidden Gems admin category manager + optional public preview URLs.
-- Run after 002_points_system.sql.

alter table public.videos
  add column if not exists preview_url text;

comment on column public.videos.preview_url is 'Optional public/share/embed URL used only for previews. Full external_video_link stays protected.';

-- Keep the safe public view updated. It still does NOT expose external_video_link.
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
  v.preview_url,
  v.access_type,
  v.published,
  v.created_at,
  v.updated_at
from public.videos v
left join public.categories c on c.id = v.category_id;

grant select on public.videos_safe to anon, authenticated;

-- Deleting a category should not delete videos. Existing FK uses on delete set null.
-- Existing RLS policy "Admins manage categories" already protects category create/update/delete.
