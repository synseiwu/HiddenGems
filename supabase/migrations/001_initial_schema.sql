-- Hidden Gems marketplace schema
-- Run with: supabase db push

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  vip_status boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category_id uuid references public.categories(id) on delete set null,
  price_cents integer not null default 0 check (price_cents >= 0),
  stripe_price_id text,
  thumbnail_url text,
  external_video_link text not null,
  access_type text not null default 'paid' check (access_type in ('paid', 'vip', 'free')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  payment_status text not null default 'paid',
  stripe_session_id text unique,
  stripe_payment_intent text,
  purchased_at timestamptz not null default now(),
  unique(user_id, video_id)
);

create table if not exists public.vip_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  stripe_subscription_id text unique,
  stripe_session_id text unique,
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  expires_at timestamptz
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace view public.videos_safe with (security_invoker = true) as
select
  v.id,
  v.title,
  v.description,
  v.category_id,
  c.name as category_name,
  v.price_cents,
  v.stripe_price_id,
  v.thumbnail_url,
  v.access_type,
  v.published,
  v.created_at,
  v.updated_at
from public.videos v
left join public.categories c on c.id = v.category_id;

create or replace function public.get_unlocked_video(target_video_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  category_name text,
  price_cents integer,
  thumbnail_url text,
  access_type text,
  external_video_link text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.title, v.description, c.name, v.price_cents, v.thumbnail_url, v.access_type, v.external_video_link
  from public.videos v
  left join public.categories c on c.id = v.category_id
  left join public.profiles p on p.id = auth.uid()
  where v.id = target_video_id
    and v.published = true
    and (
      v.access_type = 'free'
      or exists (select 1 from public.purchases pur where pur.video_id = v.id and pur.user_id = auth.uid())
      or (v.access_type = 'vip' and p.vip_status = true)
      or public.is_admin()
    );
$$;

create or replace function public.get_my_library()
returns table (
  video_id uuid,
  title text,
  description text,
  thumbnail_url text,
  external_video_link text,
  purchased_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, v.title, v.description, v.thumbnail_url, v.external_video_link, pur.purchased_at
  from public.purchases pur
  join public.videos v on v.id = pur.video_id
  where pur.user_id = auth.uid()
  union
  select v.id, v.title, v.description, v.thumbnail_url, v.external_video_link, null::timestamptz
  from public.videos v
  join public.profiles p on p.id = auth.uid()
  where p.vip_status = true and v.access_type = 'vip' and v.published = true;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.videos enable row level security;
alter table public.purchases enable row level security;
alter table public.vip_subscriptions enable row level security;

create policy "Users can read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
-- Normal users cannot update profiles directly. This prevents role/VIP self-escalation.
create policy "Admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read categories" on public.categories for select using (true);
create policy "Admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "Anyone can read published safe video rows" on public.videos for select using (published = true or public.is_admin());
create policy "Admins manage videos" on public.videos for all using (public.is_admin()) with check (public.is_admin());

create policy "Users read own purchases" on public.purchases for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage purchases" on public.purchases for all using (public.is_admin()) with check (public.is_admin());

create policy "Users read own vip records" on public.vip_subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage vip records" on public.vip_subscriptions for all using (public.is_admin()) with check (public.is_admin());

insert into public.categories (name, description) values
  ('Featured', 'Curated premium drops'),
  ('Exclusive', 'Paid access listings'),
  ('VIP', 'VIP-only content')
on conflict (name) do nothing;

-- Storage bucket: create this in Supabase Dashboard or via SQL in the storage schema if permissions allow.
-- Bucket name: thumbnails. Public read, authenticated/admin upload preferred.

-- Optional storage setup for thumbnail bucket. Run in Supabase SQL editor if available.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('thumbnails', 'thumbnails', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "Public can view thumbnails" on storage.objects
for select using (bucket_id = 'thumbnails');

create policy "Admins can upload thumbnails" on storage.objects
for insert to authenticated with check (bucket_id = 'thumbnails' and public.is_admin());

create policy "Admins can update thumbnails" on storage.objects
for update to authenticated using (bucket_id = 'thumbnails' and public.is_admin()) with check (bucket_id = 'thumbnails' and public.is_admin());

create policy "Admins can delete thumbnails" on storage.objects
for delete to authenticated using (bucket_id = 'thumbnails' and public.is_admin());
