-- Hidden Gems admin account + universal video visibility fix
-- Run this once in Supabase SQL Editor.
-- Purpose:
-- 1) Mark the two listed Supabase users as admin in public.profiles.
-- 2) Remove owner-only hg_videos policies that can hide videos uploaded by another admin.
-- 3) Allow the site/admin portal to read and manage the shared video catalog.

-- Make sure profiles can store roles.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_vip boolean not null default false,
  role text not null default 'guest',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Add/update the two admin accounts from Supabase.
insert into public.profiles (id, email, is_vip, role, updated_at)
values
  ('c5d8de69-a371-408f-a595-9aa026a6de45', 'hayzrxsloth@gmail.com', true, 'admin', now()),
  ('3ce8409c-f2d4-4372-8b2b-bb4e6f4a8b91', 'patrickkinshin223@gmail.com', true, 'admin', now())
on conflict (id) do update
set email = excluded.email,
    is_vip = true,
    role = 'admin',
    updated_at = now();

-- Replace profile policies with simple current-user read/update policies.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_record.policyname);
  end loop;
end $$;

create policy profiles_current_user_select
on public.profiles
for select
using (auth.uid() = id);

create policy profiles_current_user_insert
on public.profiles
for insert
with check (auth.uid() = id);

create policy profiles_current_user_update
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Make sure the video table has the fields the site expects.
alter table if exists public.hg_videos
  add column if not exists created_by uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_published boolean not null default true;

alter table public.hg_videos enable row level security;
alter table public.hg_videos replica identity full;

-- Remove older owner/user-scoped policies that may filter by auth.uid(), created_by, owner_id, user_id, etc.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'hg_videos'
  loop
    execute format('drop policy if exists %I on public.hg_videos', policy_record.policyname);
  end loop;
end $$;

-- Public visitors can read published/non-deleted metadata.
create policy hg_videos_public_select
on public.hg_videos
for select
using (deleted_at is null and is_published is not false);

-- Any authenticated account can insert videos because the client-side app handles admin gating.
-- This keeps the current static-site workflow from hiding cross-admin uploads.
create policy hg_videos_authenticated_insert
on public.hg_videos
for insert
with check (auth.role() = 'authenticated');

create policy hg_videos_authenticated_update
on public.hg_videos
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy hg_videos_authenticated_delete
on public.hg_videos
for delete
using (auth.role() = 'authenticated');

-- Helpful indexes for admin list/category counts.
create index if not exists hg_videos_deleted_updated_idx on public.hg_videos(deleted_at, updated_at desc);
create index if not exists hg_videos_category_slug_idx on public.hg_videos(category_slug);
create index if not exists hg_videos_created_by_idx on public.hg_videos(created_by);

-- Realtime support for cross-admin updates.
do $$
begin
  alter publication supabase_realtime add table public.hg_videos;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
