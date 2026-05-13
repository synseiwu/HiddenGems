-- Hidden Gems Stripe webhook setup
-- Run this after the previous security lockdown SQL.

create table if not exists public.hg_stripe_customers (
  stripe_customer_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hg_stripe_customers enable row level security;

drop policy if exists "hg_stripe_customers_admin_all" on public.hg_stripe_customers;
drop policy if exists "hg_stripe_customers_select_own_or_admin" on public.hg_stripe_customers;

create policy "hg_stripe_customers_select_own_or_admin"
on public.hg_stripe_customers
for select
to authenticated
using (user_id = auth.uid() or public.hg_is_admin());

create policy "hg_stripe_customers_admin_all"
on public.hg_stripe_customers
for all
to authenticated
using (public.hg_is_admin())
with check (public.hg_is_admin());

-- Optional compatibility columns/indexes used by the webhook.
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.hg_video_purchases add column if not exists status text not null default 'completed';

create unique index if not exists hg_video_purchases_user_video_uidx
on public.hg_video_purchases(user_id, video_id);

create unique index if not exists hg_payment_transactions_provider_order_uidx
on public.hg_payment_transactions(provider, order_id);
