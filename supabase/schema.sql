-- Lerna cloud sync schema
-- Run this in Supabase SQL Editor after creating a project.

create table if not exists public.lerna_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lerna_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  app_state jsonb,
  ai_state jsonb,
  v23_state jsonb,
  payload_hash text,
  device_id text,
  updated_at timestamptz not null default now()
);

alter table public.lerna_profiles enable row level security;
alter table public.lerna_snapshots enable row level security;

drop policy if exists "Users can read their Lerna profile" on public.lerna_profiles;
create policy "Users can read their Lerna profile"
on public.lerna_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their Lerna profile" on public.lerna_profiles;
create policy "Users can insert their Lerna profile"
on public.lerna_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their Lerna profile" on public.lerna_profiles;
create policy "Users can update their Lerna profile"
on public.lerna_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their Lerna snapshot" on public.lerna_snapshots;
create policy "Users can read their Lerna snapshot"
on public.lerna_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their Lerna snapshot" on public.lerna_snapshots;
create policy "Users can insert their Lerna snapshot"
on public.lerna_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their Lerna snapshot" on public.lerna_snapshots;
create policy "Users can update their Lerna snapshot"
on public.lerna_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their Lerna snapshot" on public.lerna_snapshots;
create policy "Users can delete their Lerna snapshot"
on public.lerna_snapshots
for delete
to authenticated
using ((select auth.uid()) = user_id);
