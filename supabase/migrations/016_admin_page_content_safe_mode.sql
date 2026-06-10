-- Hidden Gems admin page text editor + global safe mode settings

create table if not exists public.site_settings (
  id boolean primary key default true,
  hide_all_videos boolean not null default false,
  disable_age_gate boolean not null default false,
  safe_mode_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = true)
);

insert into public.site_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.site_page_content (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  section_key text not null,
  content_type text not null default 'section',
  title text,
  subtitle text,
  eyebrow text,
  body text,
  button_text text,
  sort_order integer not null default 1,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(page_key, section_key)
);

create index if not exists site_page_content_page_key_idx on public.site_page_content(page_key, sort_order);

alter table public.site_settings enable row level security;
alter table public.site_page_content enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Admins can manage site settings" on public.site_settings;
drop policy if exists "Public can read active page content" on public.site_page_content;
drop policy if exists "Admins can manage page content" on public.site_page_content;

create policy "Public can read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

create policy "Admins can manage site settings"
on public.site_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Public can read active page content"
on public.site_page_content
for select
to anon, authenticated
using (active = true);

create policy "Admins can manage page content"
on public.site_page_content
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop view if exists public.site_settings_public;
create view public.site_settings_public
with (security_invoker = false)
as
select id, hide_all_videos, disable_age_gate, safe_mode_enabled, updated_at
from public.site_settings;

drop view if exists public.site_page_content_public;
create view public.site_page_content_public
with (security_invoker = false)
as
select
  id,
  page_key,
  section_key,
  content_type,
  title,
  subtitle,
  eyebrow,
  body,
  button_text,
  sort_order,
  active,
  updated_at
from public.site_page_content
where active = true;

grant select on public.site_settings_public to anon, authenticated;
grant select on public.site_page_content_public to anon, authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;
grant select, insert, update, delete on public.site_page_content to authenticated;
