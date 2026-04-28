-- =========================
-- 1) UPDATED_AT FUNCTION
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================
-- 2) PROFILES TABLE
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  age integer check (age >= 1 and age <= 120),
  weight_kg numeric(6,2) check (weight_kg > 0),
  height_cm numeric(6,2) check (height_cm > 0),
  bmi numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


-- =========================
-- 3) ACTIVITY LOGS TABLE
-- =========================
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  intensity text not null check (intensity in ('LOW', 'MODERATE', 'HIGH')),
  steps integer not null default 0 check (steps >= 0),
  heart_rate integer not null default 0 check (heart_rate >= 0),
  calories integer not null default 0 check (calories >= 0),
  bmi numeric(5,2),
  distance_km numeric(6,2) not null default 0 check (distance_km >= 0),
  exercises_completed integer not null default 0 check (exercises_completed >= 0),
  feedback text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_activity_logs_updated_at on public.activity_logs;
create trigger trg_activity_logs_updated_at
before update on public.activity_logs
for each row
execute function public.set_updated_at();


-- =========================
-- 4) INDEXES
-- =========================
create index if not exists idx_activity_logs_user_id
on public.activity_logs(user_id);

create index if not exists idx_activity_logs_user_date
on public.activity_logs(user_id, activity_date desc);


-- =========================
-- 5) ENABLE RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.activity_logs enable row level security;


-- =========================
-- 6) PROFILES POLICIES
-- =========================
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);


-- =========================
-- 7) ACTIVITY LOGS POLICIES
-- =========================
drop policy if exists "activity_logs_select_own" on public.activity_logs;
create policy "activity_logs_select_own"
on public.activity_logs
for select
using (auth.uid() = user_id);

drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own"
on public.activity_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "activity_logs_update_own" on public.activity_logs;
create policy "activity_logs_update_own"
on public.activity_logs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "activity_logs_delete_own" on public.activity_logs;
create policy "activity_logs_delete_own"
on public.activity_logs
for delete
using (auth.uid() = user_id);