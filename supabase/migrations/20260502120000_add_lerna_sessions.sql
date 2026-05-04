-- W2-T04: lerna_sessions table for tracking study sessions

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.lerna_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  subject text check (subject is null or char_length(subject) <= 120),
  tags text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lerna_sessions_user_id
  on public.lerna_sessions(user_id);

create index if not exists idx_lerna_sessions_started_at
  on public.lerna_sessions(started_at desc);

alter table public.lerna_sessions enable row level security;

create policy "users see own sessions"
  on public.lerna_sessions
  for select
  using (auth.uid() = user_id);

create policy "users insert own sessions"
  on public.lerna_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "users update own sessions"
  on public.lerna_sessions
  for update
  using (auth.uid() = user_id);

create policy "users delete own sessions"
  on public.lerna_sessions
  for delete
  using (auth.uid() = user_id);

drop trigger if exists lerna_sessions_set_updated_at on public.lerna_sessions;

create trigger lerna_sessions_set_updated_at
  before update on public.lerna_sessions
  for each row
  execute function public.set_updated_at();
