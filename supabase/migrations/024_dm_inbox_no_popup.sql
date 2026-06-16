-- Real DM inbox system + remove large onboarding popup path.
-- Run this after the site_messages migration.

create table if not exists public.messaging_settings (
  id boolean primary key default true,
  enable_user_dms boolean not null default true,
  allow_user_to_user_dms boolean not null default true,
  allow_users_to_reply_to_admin_messages boolean not null default true,
  dm_unread_badge_enabled boolean not null default true,
  announcements_popup_enabled boolean not null default false,
  onboarding_message_enabled boolean not null default true,
  onboarding_message_as_inbox_only boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint messaging_settings_singleton check (id = true)
);

insert into public.messaging_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  conversation_type text not null default 'direct',
  title text null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm_conversation_type_check check (conversation_type in ('direct', 'admin_direct', 'broadcast', 'system'))
);

create table if not exists public.dm_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  last_read_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id),
  constraint dm_participant_role_check check (role in ('member', 'admin', 'moderator'))
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_label text null,
  body text not null,
  message_kind text not null default 'user',
  created_at timestamptz not null default now(),
  constraint dm_message_kind_check check (message_kind in ('user', 'admin', 'broadcast', 'system'))
);

create index if not exists dm_conversations_updated_idx on public.dm_conversations(updated_at desc);
create index if not exists dm_participants_user_idx on public.dm_participants(user_id, archived_at);
create index if not exists dm_participants_conversation_idx on public.dm_participants(conversation_id);
create index if not exists dm_messages_conversation_created_idx on public.dm_messages(conversation_id, created_at);

alter table public.messaging_settings enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.dm_participants enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists "Authenticated read messaging settings" on public.messaging_settings;
drop policy if exists "Admins manage messaging settings" on public.messaging_settings;
drop policy if exists "Users read own conversations" on public.dm_conversations;
drop policy if exists "Users create own conversations" on public.dm_conversations;
drop policy if exists "Users update own conversations" on public.dm_conversations;
drop policy if exists "Admins manage conversations" on public.dm_conversations;
drop policy if exists "Users read own participants" on public.dm_participants;
drop policy if exists "Users create participants for own conversations" on public.dm_participants;
drop policy if exists "Users update own participant row" on public.dm_participants;
drop policy if exists "Admins manage participants" on public.dm_participants;
drop policy if exists "Users read own dm messages" on public.dm_messages;
drop policy if exists "Users create dm messages" on public.dm_messages;
drop policy if exists "Admins manage dm messages" on public.dm_messages;

create policy "Authenticated read messaging settings" on public.messaging_settings for select to authenticated using (true);
create policy "Admins manage messaging settings" on public.messaging_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own conversations" on public.dm_conversations for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.dm_participants p where p.conversation_id = id and p.user_id = auth.uid())
);

create policy "Users create own conversations" on public.dm_conversations for insert to authenticated with check (created_by = auth.uid() or public.is_admin());

create policy "Users update own conversations" on public.dm_conversations for update to authenticated using (
  public.is_admin()
  or exists (select 1 from public.dm_participants p where p.conversation_id = id and p.user_id = auth.uid())
) with check (
  public.is_admin()
  or exists (select 1 from public.dm_participants p where p.conversation_id = id and p.user_id = auth.uid())
);

create policy "Admins manage conversations" on public.dm_conversations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own participants" on public.dm_participants for select to authenticated using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (select 1 from public.dm_participants self where self.conversation_id = dm_participants.conversation_id and self.user_id = auth.uid())
);

create policy "Users create participants for own conversations" on public.dm_participants for insert to authenticated with check (
  public.is_admin()
  or exists (select 1 from public.dm_conversations c where c.id = conversation_id and c.created_by = auth.uid())
);

create policy "Users update own participant row" on public.dm_participants for update to authenticated using (public.is_admin() or user_id = auth.uid()) with check (public.is_admin() or user_id = auth.uid());
create policy "Admins manage participants" on public.dm_participants for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own dm messages" on public.dm_messages for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.dm_participants p where p.conversation_id = dm_messages.conversation_id and p.user_id = auth.uid())
);

create policy "Users create dm messages" on public.dm_messages for insert to authenticated with check (
  public.is_admin()
  or (
    sender_id = auth.uid()
    and message_kind = 'user'
    and exists (select 1 from public.dm_participants p where p.conversation_id = dm_messages.conversation_id and p.user_id = auth.uid() and p.archived_at is null)
  )
);

create policy "Admins manage dm messages" on public.dm_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop view if exists public.messaging_user_directory;
create view public.messaging_user_directory with (security_invoker = false) as
select p.id, p.email, p.role, coalesce(p.vip_rank, 0) as vip_rank, coalesce(p.subscription_tier, 'none') as subscription_tier
from public.profiles p
where p.email is not null;

drop view if exists public.dm_conversations_for_user;
create view public.dm_conversations_for_user with (security_invoker = false) as
select
  viewer.user_id as viewer_user_id,
  c.id as conversation_id,
  c.conversation_type,
  c.title,
  c.is_system,
  c.created_at,
  c.updated_at,
  other_user.email as other_participant_email,
  coalesce(c.title, other_user.email, 'Conversation') as display_title,
  last_msg.body as last_message_body,
  last_msg.created_at as last_message_at,
  count(unread.id)::integer as unread_count
from public.dm_participants viewer
join public.dm_conversations c on c.id = viewer.conversation_id
left join public.dm_participants other_participant on other_participant.conversation_id = c.id and other_participant.user_id <> viewer.user_id
left join public.profiles other_user on other_user.id = other_participant.user_id
left join lateral (
  select m.body, m.created_at
  from public.dm_messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) last_msg on true
left join public.dm_messages unread on unread.conversation_id = c.id
  and unread.created_at > coalesce(viewer.last_read_at, '1970-01-01'::timestamptz)
  and (unread.sender_id is null or unread.sender_id <> viewer.user_id)
where viewer.archived_at is null
group by viewer.user_id, c.id, c.conversation_type, c.title, c.is_system, c.created_at, c.updated_at, other_user.email, last_msg.body, last_msg.created_at;

grant select on public.messaging_settings to authenticated;
grant select on public.messaging_user_directory to authenticated;
grant select on public.dm_conversations_for_user to authenticated;
grant select, insert, update, delete on public.dm_conversations to authenticated;
grant select, insert, update, delete on public.dm_participants to authenticated;
grant select, insert, update, delete on public.dm_messages to authenticated;

-- Make welcome info inbox-only, not popup.
update public.site_messages
set active = true,
    popup_enabled = false,
    requires_acknowledgement = false,
    show_once = true,
    title = 'Welcome to AI Studio',
    body = 'Your account is active. AI Studio is the main platform. For platform access details, open Access Info from the footer or account menu. Your same account and points wallet work across enabled platform areas.',
    updated_at = now()
where title = 'Welcome to AI Studio';

insert into public.site_messages (title, body, message_type, priority, audience, active, popup_enabled, requires_acknowledgement, show_once)
select
  'Welcome to AI Studio',
  'Your account is active. AI Studio is the main platform. For platform access details, open Access Info from the footer or account menu. Your same account and points wallet work across enabled platform areas.',
  'announcement',
  'normal',
  'all',
  true,
  false,
  false,
  true
where not exists (select 1 from public.site_messages where title = 'Welcome to AI Studio');

select pg_notify('pgrst', 'reload schema');

select
  to_regclass('public.dm_conversations') as dm_conversations,
  to_regclass('public.dm_participants') as dm_participants,
  to_regclass('public.dm_messages') as dm_messages,
  to_regclass('public.messaging_settings') as messaging_settings;
