-- AI Studio should be the default public site from now on.
-- Hidden Gems should only appear when the Access Info switch is clicked for that browser/session.

alter table public.site_settings
  add column if not exists site_mode text not null default 'ai_studio';

alter table public.site_settings
  add column if not exists ai_studio_public_mode boolean not null default true;

alter table public.site_settings
  add column if not exists hide_hidden_gems_branding boolean not null default true;

alter table public.site_settings
  add column if not exists hide_video_marketplace_in_ai_mode boolean not null default true;

update public.site_settings
set
  site_mode = 'ai_studio',
  ai_studio_public_mode = true,
  disable_age_gate = true,
  hide_hidden_gems_branding = true,
  hide_video_marketplace_in_ai_mode = true,
  updated_at = now()
where id = true or key = 'global';

alter table public.site_settings
  alter column site_mode set default 'ai_studio';

alter table public.site_settings
  alter column ai_studio_public_mode set default true;

select
  key,
  site_mode,
  ai_studio_public_mode,
  disable_age_gate,
  hide_video_marketplace_in_ai_mode,
  updated_at
from public.site_settings;
