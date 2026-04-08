-- Hidden Gems live-ready video schema alignment
-- Run this in Supabase SQL editor before launch.

alter table if exists public.hg_videos
  add column if not exists image text not null default '',
  add column if not exists video_storage_path text,
  add column if not exists is_published boolean not null default true,
  add column if not exists created_by uuid,
  add column if not exists category_slug text,
  add column if not exists category_title text,
  add column if not exists points integer,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.hg_videos
set category_slug = coalesce(nullif(category_slug, ''), 'creator-picks')
where category_slug is null or category_slug = '';

update public.hg_videos
set category_title = case category_slug
  when 'new-releases' then 'Category 1'
  when 'most-popular' then 'Category 2'
  when 'behind-the-scenes' then 'Category 3'
  when 'live-sessions' then 'Category 4'
  when 'short-films' then 'Category 5'
  when 'creator-picks' then 'Category 6'
  when 'vip-exclusives' then 'Category 7'
  else initcap(replace(category_slug, '-', ' '))
end
where category_title is null or category_title = '';

update public.hg_videos
set image = coalesce(nullif(image, ''), thumbnail_url, '')
where coalesce(image, '') = '';

update public.hg_videos
set points = coalesce(points, sort_order, 0)
where points is null;

alter table public.hg_videos
  alter column category_slug set default 'creator-picks',
  alter column category_title set default 'Category 6',
  alter column points set default 0;

create index if not exists hg_videos_category_slug_idx on public.hg_videos(category_slug);
create index if not exists hg_videos_is_published_idx on public.hg_videos(is_published) where deleted_at is null;

alter table public.hg_videos replica identity full;


alter table public.hg_videos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_select_all'
  ) then
    create policy hg_videos_select_all on public.hg_videos for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_insert_all'
  ) then
    create policy hg_videos_insert_all on public.hg_videos for insert with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_update_all'
  ) then
    create policy hg_videos_update_all on public.hg_videos for update using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_delete_all'
  ) then
    create policy hg_videos_delete_all on public.hg_videos for delete using (true);
  end if;
end $$;


-- Storage bucket expected by the fixed site.js upload flow.
insert into storage.buckets (id, name, public)
select 'hg-videos', 'hg-videos', false
where not exists (select 1 from storage.buckets where id = 'hg-videos');

-- Storage policies (adjust if you want tighter auth rules later).
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'hg_videos_storage_select'
  ) then
    create policy hg_videos_storage_select on storage.objects for select using (bucket_id = 'hg-videos');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'hg_videos_storage_insert'
  ) then
    create policy hg_videos_storage_insert on storage.objects for insert with check (bucket_id = 'hg-videos');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'hg_videos_storage_update'
  ) then
    create policy hg_videos_storage_update on storage.objects for update using (bucket_id = 'hg-videos') with check (bucket_id = 'hg-videos');
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'hg_videos_storage_delete'
  ) then
    create policy hg_videos_storage_delete on storage.objects for delete using (bucket_id = 'hg-videos');
  end if;
end $$;
