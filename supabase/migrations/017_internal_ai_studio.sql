-- Hidden Gems internal AI Studio
-- Adds AI settings, conversations, messages, and usage logs.

create table if not exists public.ai_settings (
  id boolean primary key default true,
  enabled boolean not null default true,
  admin_free boolean not null default true,
  model text not null default 'gpt-4.1-mini',
  points_per_message integer not null default 25 check (points_per_message >= 0),
  max_output_tokens integer not null default 900 check (max_output_tokens between 50 and 4000),
  system_prompt text not null default 'You are Hidden Gems AI Studio, a helpful assistant inside the Hidden Gems platform. Be useful, clear, and safe.',
  updated_at timestamptz not null default now(),
  constraint ai_settings_singleton check (id = true)
);

insert into public.ai_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New AI Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_updated_idx
on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  points_charged integer not null default 0,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_created_idx
on public.ai_messages(conversation_id, created_at asc);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  model text,
  points_charged integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_created_idx
on public.ai_usage_logs(user_id, created_at desc);

alter table public.ai_settings enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_logs enable row level security;

drop policy if exists "Authenticated can read AI public settings" on public.ai_settings;
drop policy if exists "Admins can manage AI settings" on public.ai_settings;
drop policy if exists "Users can read own AI conversations" on public.ai_conversations;
drop policy if exists "Users can create own AI conversations" on public.ai_conversations;
drop policy if exists "Users can update own AI conversations" on public.ai_conversations;
drop policy if exists "Admins can manage all AI conversations" on public.ai_conversations;
drop policy if exists "Users can read own AI messages" on public.ai_messages;
drop policy if exists "Users can create own AI messages" on public.ai_messages;
drop policy if exists "Admins can manage all AI messages" on public.ai_messages;
drop policy if exists "Users can read own AI usage logs" on public.ai_usage_logs;
drop policy if exists "Admins can manage all AI usage logs" on public.ai_usage_logs;

create policy "Authenticated can read AI public settings"
on public.ai_settings
for select
to authenticated
using (true);

create policy "Admins can manage AI settings"
on public.ai_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users can read own AI conversations"
on public.ai_conversations
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Users can create own AI conversations"
on public.ai_conversations
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

create policy "Users can update own AI conversations"
on public.ai_conversations
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage all AI conversations"
on public.ai_conversations
for delete
to authenticated
using (public.is_admin());

create policy "Users can read own AI messages"
on public.ai_messages
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Users can create own AI messages"
on public.ai_messages
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage all AI messages"
on public.ai_messages
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users can read own AI usage logs"
on public.ai_usage_logs
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage all AI usage logs"
on public.ai_usage_logs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop view if exists public.ai_settings_public;
create view public.ai_settings_public
with (security_invoker = false)
as
select
  id,
  enabled,
  model,
  points_per_message,
  max_output_tokens,
  updated_at
from public.ai_settings;

grant select on public.ai_settings_public to authenticated;
grant select, insert, update, delete on public.ai_settings to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant select, insert, update, delete on public.ai_usage_logs to authenticated;

select id, enabled, model, points_per_message, max_output_tokens, updated_at
from public.ai_settings;
