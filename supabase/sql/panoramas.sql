-- Panoramas table, RLS and trigger
-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.panoramas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists panoramas_owner_id_idx on public.panoramas(owner_id);
create index if not exists panoramas_status_idx on public.panoramas(status);
create index if not exists panoramas_not_deleted_idx on public.panoramas((deleted_at is null));

alter table public.panoramas enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='panoramas' AND policyname='Panoramas: owner select'
  ) THEN
    CREATE POLICY "Panoramas: owner select" ON public.panoramas
      FOR SELECT USING (auth.uid() = owner_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='panoramas' AND policyname='Panoramas: owner insert'
  ) THEN
    CREATE POLICY "Panoramas: owner insert" ON public.panoramas
      FOR INSERT WITH CHECK (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='panoramas' AND policyname='Panoramas: owner update'
  ) THEN
    CREATE POLICY "Panoramas: owner update" ON public.panoramas
      FOR UPDATE USING (auth.uid() = owner_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='panoramas' AND policyname='Panoramas: owner delete'
  ) THEN
    CREATE POLICY "Panoramas: owner delete" ON public.panoramas
      FOR DELETE USING (auth.uid() = owner_id);
  END IF;

  -- Allow public to read active panoramas (for response form)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='panoramas' AND policyname='Panoramas: public select active'
  ) THEN
    CREATE POLICY "Panoramas: public select active" ON public.panoramas
      FOR SELECT USING (status = 'active' AND deleted_at IS NULL);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'panoramas_set_updated_at'
  ) THEN
    CREATE TRIGGER panoramas_set_updated_at
    BEFORE UPDATE ON public.panoramas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;


