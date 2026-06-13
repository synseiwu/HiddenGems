-- Hidden Gems / AI Studio: make AI Studio the default first public mode.
-- This keeps the same accounts, points, pricing, and wallet. It only changes the default public site mode.

alter table public.site_settings
  add column if not exists site_mode text not null default 'ai_studio';

alter table public.site_settings
  add column if not exists ai_studio_public_mode boolean not null default true;

alter table public.site_settings
  add column if not exists hide_hidden_gems_branding boolean not null default true;

alter table public.site_settings
  add column if not exists hide_video_marketplace_in_ai_mode boolean not null default true;

alter table public.site_settings
  add column if not exists show_admin_mode_switch boolean not null default true;

alter table public.site_settings
  add column if not exists show_public_mode_switch boolean not null default false;

-- Make the current singleton row load AI Studio first.
update public.site_settings
set
  site_mode = 'ai_studio',
  ai_studio_public_mode = true,
  hide_hidden_gems_branding = true,
  hide_video_marketplace_in_ai_mode = true,
  disable_age_gate = true,
  updated_at = now()
where id = true or key = 'global';

-- Change future default values too.
alter table public.site_settings
  alter column site_mode set default 'ai_studio';

alter table public.site_settings
  alter column ai_studio_public_mode set default true;

alter table public.site_settings
  alter column hide_hidden_gems_branding set default true;

alter table public.site_settings
  alter column hide_video_marketplace_in_ai_mode set default true;

-- Make sure the public view includes the mode columns.
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
  disable_age_gate,
  hide_video_marketplace_in_ai_mode,
  show_admin_mode_switch,
  show_public_mode_switch
from public.site_settings;
