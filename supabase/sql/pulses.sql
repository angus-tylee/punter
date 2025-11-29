-- Pulses table, RLS and trigger
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.pulses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  instagram_post_url text not null,
  instagram_post_id text not null, -- Extracted from URL
  status text not null default 'draft' check (status in ('draft','active','archived')),
  context jsonb, -- Event context for LLM generation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists pulses_owner_id_idx on public.pulses(owner_id);
create index if not exists pulses_status_idx on public.pulses(status);
create index if not exists pulses_not_deleted_idx on public.pulses((deleted_at is null));
create index if not exists pulses_instagram_post_id_idx on public.pulses(instagram_post_id);

alter table public.pulses enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulses' AND policyname='Pulses: owner select'
  ) THEN
    CREATE POLICY "Pulses: owner select" ON public.pulses
      FOR SELECT USING (auth.uid() = owner_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulses' AND policyname='Pulses: owner insert'
  ) THEN
    CREATE POLICY "Pulses: owner insert" ON public.pulses
      FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulses' AND policyname='Pulses: owner update'
  ) THEN
    CREATE POLICY "Pulses: owner update" ON public.pulses
      FOR UPDATE USING (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulses' AND policyname='Pulses: owner delete'
  ) THEN
    CREATE POLICY "Pulses: owner delete" ON public.pulses
      FOR DELETE USING (auth.uid() = owner_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pulses_set_updated_at'
  ) THEN
    CREATE TRIGGER pulses_set_updated_at
    BEFORE UPDATE ON public.pulses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

