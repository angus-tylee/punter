-- Events table, RLS and trigger
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_type text,
  date date,
  capacity integer,
  venue text,
  event_url text,
  lineup jsonb default '[]'::jsonb, -- Array of {name, rank} objects
  pricing_tiers jsonb default '[]'::jsonb, -- Array of {name, price} objects
  vip_info jsonb default '{}'::jsonb, -- {enabled: bool, tiers: [], included: []}
  bar_partners jsonb default '[]'::jsonb, -- Array of {brand, drinks: [], pricing: []}
  target_market text,
  current_stage text not null default 'early_planning' check (current_stage in ('early_planning', 'mid_campaign', 'post_event')),
  promoter_name text, -- Manually stubbed for now
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists events_owner_id_idx on public.events(owner_id);
create index if not exists events_current_stage_idx on public.events(current_stage);
create index if not exists events_not_deleted_idx on public.events((deleted_at is null));

alter table public.events enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Events: owner select'
  ) THEN
    CREATE POLICY "Events: owner select" ON public.events
      FOR SELECT USING (auth.uid() = owner_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Events: owner insert'
  ) THEN
    CREATE POLICY "Events: owner insert" ON public.events
      FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Events: owner update'
  ) THEN
    CREATE POLICY "Events: owner update" ON public.events
      FOR UPDATE USING (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Events: owner delete'
  ) THEN
    CREATE POLICY "Events: owner delete" ON public.events
      FOR DELETE USING (auth.uid() = owner_id);
  END IF;
END
$$;

-- Use existing set_updated_at function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'events_set_updated_at'
  ) THEN
    CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

