-- Hidden Gems / AI Studio public site mode controls.
-- Run after 016/017 migrations.

alter table public.site_settings
  add column if not exists site_mode text not null default 'hidden_gems';

alter table public.site_settings
  add column if not exists ai_studio_public_mode boolean not null default false;

alter table public.site_settings
  add column if not exists hide_hidden_gems_branding boolean not null default true;

alter table public.site_settings
  add column if not exists hide_video_marketplace_in_ai_mode boolean not null default true;

alter table public.site_settings
  add column if not exists show_admin_mode_switch boolean not null default true;

alter table public.site_settings
  add column if not exists show_public_mode_switch boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_site_mode_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_site_mode_check
      check (site_mode in ('hidden_gems', 'ai_studio'));
  end if;
end $$;

update public.site_settings
set
  site_mode = coalesce(site_mode, 'hidden_gems'),
  ai_studio_public_mode = coalesce(ai_studio_public_mode, false),
  hide_hidden_gems_branding = coalesce(hide_hidden_gems_branding, true),
  hide_video_marketplace_in_ai_mode = coalesce(hide_video_marketplace_in_ai_mode, true),
  show_admin_mode_switch = coalesce(show_admin_mode_switch, true),
  show_public_mode_switch = coalesce(show_public_mode_switch, false),
  updated_at = now()
where id = true or key = 'global';

drop view if exists public.site_settings_public;
create view public.site_settings_public
with (security_invoker = false)
as
select
  id,
  key,
  hide_all_videos,
  disable_age_gate,
  safe_mode_enabled,
  site_mode,
  ai_studio_public_mode,
  hide_hidden_gems_branding,
  hide_video_marketplace_in_ai_mode,
  show_admin_mode_switch,
  show_public_mode_switch,
  updated_at
from public.site_settings;

grant select on public.site_settings_public to anon, authenticated;

select
  key,
  id,
  site_mode,
  ai_studio_public_mode,
  hide_hidden_gems_branding,
  hide_video_marketplace_in_ai_mode,
  show_admin_mode_switch,
  show_public_mode_switch
from public.site_settings;
