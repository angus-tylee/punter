-- profiles.sql (fixed policy existence checks)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles: owners can select'
  ) then
    create policy "Profiles: owners can select" on public.profiles
      for select using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles: owners can upsert'
  ) then
    create policy "Profiles: owners can upsert" on public.profiles
      for insert with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles: owners can update'
  ) then
    create policy "Profiles: owners can update" on public.profiles
      for update using (auth.uid() = id);
  end if;
end
$$;