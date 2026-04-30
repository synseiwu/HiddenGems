-- Hidden Gems live-ready video schema alignment
-- Run this in Supabase SQL editor before launch.

alter table if exists public.hg_videos
  add column if not exists image text not null default '',
  add column if not exists video_storage_path text,
  add column if not exists video_file text,
  add column if not exists video_file_name text,
  add column if not exists video_mime_type text,
  add column if not exists source_type text,
  add column if not exists is_published boolean not null default true,
  add column if not exists created_by uuid,
  add column if not exists category_slug text,
  add column if not exists category_title text,
  add column if not exists price_cents integer,
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
set price_cents = case
  when price_cents is not null and price_cents > 0 then price_cents
  when points in (300, 500, 700) then points
  when sort_order in (300, 500, 700) then sort_order
  else 0
end
where price_cents is null or price_cents <= 0;

alter table public.hg_videos
  alter column category_slug set default 'creator-picks',
  alter column category_title set default 'Category 6',
  alter column price_cents set default 0,
  alter column source_type set default 'link';

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


update public.hg_videos
set source_type = case
  when coalesce(video_storage_path, '') <> '' then 'file'
  when coalesce(video_url, '') <> '' then 'link'
  else coalesce(nullif(source_type, ''), 'link')
end
where source_type is null or source_type = '';


alter table public.hg_videos
add column if not exists preview_image_enabled boolean default true;

alter table public.hg_videos
add column if not exists preview_video_enabled boolean default false;

alter table public.hg_videos
add column if not exists preview_image_url text;

alter table public.hg_videos
add column if not exists preview_video_url text;

alter table public.hg_videos
add column if not exists external_file_url text;

create table if not exists public.hg_video_purchases (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  role_at_purchase text,
  title_snapshot text,
  amount_paid_cents integer default 0,
  created_at timestamptz default now(),
  primary key (user_id, video_id)
);

alter table public.hg_video_purchases enable row level security;

do $$ begin
  create policy "hg_video_purchases_select_own" on public.hg_video_purchases
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_video_purchases_insert_own" on public.hg_video_purchases
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_video_purchases_update_own" on public.hg_video_purchases
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_video_purchases_delete_own" on public.hg_video_purchases
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;


-- Shared category manager used by the admin portal.
-- This fixes category names/descriptions only changing in one browser.
create table if not exists public.hg_categories (
  slug text primary key,
  title text not null,
  description text not null default '',
  is_core boolean not null default false,
  sort_order integer not null default 999,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.hg_categories (slug, title, description, is_core, sort_order)
values
  ('new-releases', 'New Releases', 'Fresh premium drops added to the Hidden Gems vault. Unlock fast-moving releases before they rotate into the archive.', true, 10),
  ('most-popular', 'Most Popular', 'Top-performing videos across the platform, based on viewer demand and replay value.', true, 20),
  ('behind-the-scenes', 'Behind the Scenes', 'Process footage, setup moments, studio energy, and the making-of content that viewers usually never get to see.', true, 30),
  ('live-sessions', 'Live Sessions', 'Performance-driven content with live energy, room texture, and premium session-style presentation.', true, 40),
  ('short-films', 'Short Films', 'Story-driven premium visuals with cinematic structure, sharper pacing, and high replay value.', true, 50),
  ('creator-picks', 'Creator Picks', 'Hand-selected standouts that represent the strongest direction, quality, and replay value in the vault.', true, 60),
  ('vip-exclusives', 'VIP Exclusives', 'Members-only premium vault content. These titles stay locked unless VIP access is active on the account.', true, 70)
on conflict (slug) do update set
  title = excluded.title,
  description = coalesce(nullif(public.hg_categories.description, ''), excluded.description),
  is_core = excluded.is_core,
  sort_order = excluded.sort_order,
  deleted_at = null,
  updated_at = now();

alter table public.hg_categories enable row level security;

create index if not exists hg_categories_deleted_at_idx on public.hg_categories(deleted_at);
create index if not exists hg_categories_sort_order_idx on public.hg_categories(sort_order);

alter table public.hg_categories replica identity full;

do $$ begin
  create policy "hg_categories_select_all" on public.hg_categories
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_categories_insert_all" on public.hg_categories
    for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_categories_update_all" on public.hg_categories
    for update using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "hg_categories_delete_all" on public.hg_categories
    for delete using (true);
exception when duplicate_object then null; end $$;
