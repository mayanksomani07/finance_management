-- ============================================================
-- FinTrack Schema — multi-user with RLS
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── transactions ─────────────────────────────────────────────────────────────

create table if not exists transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz default now(),
  transaction_at  timestamptz not null,
  amount          numeric(12,2) not null,
  type            text not null check (type in ('income','expense')),
  category        text,
  source          text,
  description     text,
  raw_text        text,
  account_last4   text,
  balance_after   numeric(12,2)
);

create index if not exists transactions_user_idx  on transactions(user_id);
create index if not exists transactions_type_idx  on transactions(type);
create index if not exists transactions_at_idx    on transactions(transaction_at desc);
create index if not exists transactions_created_idx on transactions(created_at desc);

alter table transactions enable row level security;

create policy "users can manage own transactions"
  on transactions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── balance_snapshots ────────────────────────────────────────────────────────

create table if not exists balance_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz default now(),
  snapshot_at     timestamptz not null default now(),
  actual_balance  numeric(12,2) not null,
  note            text
);

alter table balance_snapshots enable row level security;

create policy "users can manage own snapshots"
  on balance_snapshots for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── wealth_manual ────────────────────────────────────────────────────────────

create table if not exists wealth_manual (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  value       numeric(14,2) not null,
  note        text,
  updated_at  timestamptz not null default now(),
  unique(user_id, key)
);

alter table wealth_manual enable row level security;

create policy "users can manage own wealth entries"
  on wealth_manual for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── user_profiles ────────────────────────────────────────────────────────────
-- Stores display name, avatar_url, role (user | admin) — synced from OAuth

create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz default now()
);

alter table user_profiles enable row level security;

-- Users can only read/update their own profile
create policy "users can manage own profile"
  on user_profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin role reads all profiles (for admin dashboard)
-- We use service key server-side for admin queries — no RLS policy needed there

-- ─── Auto-create profile on signup ───────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
