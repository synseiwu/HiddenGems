-- Hidden Gems universal admin video visibility fix
-- Run this once in the Supabase SQL editor if one admin cannot see/edit videos uploaded by another admin.
-- It replaces any older owner/user-scoped hg_videos policies with shared catalog policies.

alter table if exists public.hg_videos
  add column if not exists created_by uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists is_published boolean not null default true;

alter table public.hg_videos enable row level security;
alter table public.hg_videos replica identity full;

-- Remove older policies that may have filtered rows by auth.uid(), created_by, owner_id, or user_id.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hg_videos'
  loop
    execute format('drop policy if exists %I on public.hg_videos', policy_record.policyname);
  end loop;
end $$;

-- Shared catalog read access: every visitor can read published/non-deleted video metadata.
create policy hg_videos_shared_select
on public.hg_videos
for select
using (deleted_at is null and is_published is not false);

-- Admin tooling runs from the client app, so these policies keep the current app workflow working
-- while preventing owner-only filtering from hiding videos across admin accounts.
create policy hg_videos_shared_insert
on public.hg_videos
for insert
with check (auth.role() = 'authenticated');

create policy hg_videos_shared_update
on public.hg_videos
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy hg_videos_shared_delete
on public.hg_videos
for delete
using (auth.role() = 'authenticated');

-- Make realtime updates fire consistently when videos change.
do $$
begin
  alter publication supabase_realtime add table public.hg_videos;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Optional but helpful for sorting and category counts.
create index if not exists hg_videos_deleted_updated_idx on public.hg_videos(deleted_at, updated_at desc);
create index if not exists hg_videos_category_slug_idx on public.hg_videos(category_slug);
