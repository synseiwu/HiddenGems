-- Site-wide admin messages, inbox, and verified-account onboarding popup.
-- Run this in Supabase SQL Editor before deploying the frontend patch.

create table if not exists public.site_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  message_type text not null default 'announcement',
  priority text not null default 'normal',
  audience text not null default 'all',
  active boolean not null default true,
  popup_enabled boolean not null default false,
  requires_acknowledgement boolean not null default false,
  show_once boolean not null default true,
  expires_at timestamptz null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_messages_type_check check (message_type in ('announcement', 'update', 'warning', 'support', 'promotion', 'system')),
  constraint site_messages_priority_check check (priority in ('normal', 'important', 'urgent')),
  constraint site_messages_audience_check check (audience in ('all', 'authenticated', 'users', 'vip', 'supervip', 'ultravip', 'admins'))
);

create table if not exists public.site_message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.site_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz null,
  acknowledged_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.user_onboarding_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_access_popup_seen boolean not null default false,
  verified_access_popup_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_messages_active_created_idx
on public.site_messages(active, created_at desc);

create index if not exists site_messages_expires_idx
on public.site_messages(expires_at);

create index if not exists site_message_reads_user_idx
on public.site_message_reads(user_id, message_id);

alter table public.site_messages enable row level security;
alter table public.site_message_reads enable row level security;
alter table public.user_onboarding_status enable row level security;

drop policy if exists "Admins manage site messages" on public.site_messages;
drop policy if exists "Users read active site messages" on public.site_messages;
drop policy if exists "Admins read all message reads" on public.site_message_reads;
drop policy if exists "Users manage own message reads" on public.site_message_reads;
drop policy if exists "Users read own onboarding status" on public.user_onboarding_status;
drop policy if exists "Users insert own onboarding status" on public.user_onboarding_status;
drop policy if exists "Users update own onboarding status" on public.user_onboarding_status;
drop policy if exists "Admins read onboarding status" on public.user_onboarding_status;

create policy "Admins manage site messages"
on public.site_messages
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users read active site messages"
on public.site_messages
for select
to authenticated
using (
  active = true
  and (expires_at is null or expires_at > now())
  and (
    audience in ('all', 'authenticated', 'users')
    or (audience = 'admins' and public.is_admin())
    or (
      audience = 'vip'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (coalesce(p.vip_rank, 0) >= 1 or coalesce(p.vip_status, false) = true or p.role = 'admin')
      )
    )
    or (
      audience = 'supervip'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (coalesce(p.vip_rank, 0) >= 2 or p.role = 'admin')
      )
    )
    or (
      audience = 'ultravip'
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (coalesce(p.vip_rank, 0) >= 3 or p.role = 'admin')
      )
    )
  )
);

create policy "Admins read all message reads"
on public.site_message_reads
for select
to authenticated
using (public.is_admin());

create policy "Users manage own message reads"
on public.site_message_reads
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users read own onboarding status"
on public.user_onboarding_status
for select
to authenticated
using (user_id = auth.uid());

create policy "Users insert own onboarding status"
on public.user_onboarding_status
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users update own onboarding status"
on public.user_onboarding_status
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admins read onboarding status"
on public.user_onboarding_status
for select
to authenticated
using (public.is_admin());

grant select, insert, update, delete on public.site_messages to authenticated;
grant select, insert, update, delete on public.site_message_reads to authenticated;
grant select, insert, update on public.user_onboarding_status to authenticated;

-- Seed one inactive example admins can edit/activate.
insert into public.site_messages (
  title,
  body,
  message_type,
  priority,
  audience,
  active,
  popup_enabled,
  requires_acknowledgement,
  show_once
)
values (
  'Welcome to AI Studio',
  'AI Studio is the main platform. To access Hidden Gems video mode, open Access Info and use the discreet switch near the bottom of that page.',
  'announcement',
  'normal',
  'all',
  false,
  true,
  false,
  true
)
on conflict do nothing;

select pg_notify('pgrst', 'reload schema');

select
  to_regclass('public.site_messages') as site_messages,
  to_regclass('public.site_message_reads') as site_message_reads,
  to_regclass('public.user_onboarding_status') as user_onboarding_status;
