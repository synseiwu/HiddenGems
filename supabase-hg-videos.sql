create table if not exists public.hg_videos (
  id text primary key,
  title text not null,
  description text not null default '',
  image text not null default '',
  video_url text not null default '',
  video_file text not null default '',
  video_file_name text not null default '',
  video_mime_type text not null default '',
  source_type text not null default 'link',
  category_slug text not null default 'creator-picks',
  category_title text not null default '',
  access_type text not null default 'guest' check (access_type in ('guest','vip')),
  points integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_hg_videos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hg_videos_updated_at on public.hg_videos;
create trigger trg_hg_videos_updated_at
before update on public.hg_videos
for each row execute function public.set_hg_videos_updated_at();

alter table public.hg_videos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_select_all'
  ) then
    create policy hg_videos_select_all on public.hg_videos for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_insert_all'
  ) then
    create policy hg_videos_insert_all on public.hg_videos for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_update_all'
  ) then
    create policy hg_videos_update_all on public.hg_videos for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'hg_videos' and policyname = 'hg_videos_delete_all'
  ) then
    create policy hg_videos_delete_all on public.hg_videos for delete using (true);
  end if;
end $$;
