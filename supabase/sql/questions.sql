-- Questions table, RLS and trigger
-- Run this in Supabase SQL Editor

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  panorama_id uuid not null references public.panoramas(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('text', 'textarea', 'Single-select', 'Multi-select', 'Likert')),
  options jsonb null,
  required boolean not null default false,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_panorama_id_idx on public.questions(panorama_id);
create index if not exists questions_order_idx on public.questions(panorama_id, "order");

alter table public.questions enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='Questions: owner select'
  ) THEN
    CREATE POLICY "Questions: owner select" ON public.questions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = questions.panorama_id 
          AND panoramas.owner_id = auth.uid()
          AND panoramas.deleted_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='Questions: owner insert'
  ) THEN
    CREATE POLICY "Questions: owner insert" ON public.questions
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = questions.panorama_id 
          AND panoramas.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='Questions: owner update'
  ) THEN
    CREATE POLICY "Questions: owner update" ON public.questions
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = questions.panorama_id 
          AND panoramas.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='Questions: owner delete'
  ) THEN
    CREATE POLICY "Questions: owner delete" ON public.questions
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = questions.panorama_id 
          AND panoramas.owner_id = auth.uid()
        )
      );
  END IF;

  -- Allow public to read questions for active panoramas (for response form)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='Questions: public select active'
  ) THEN
    CREATE POLICY "Questions: public select active" ON public.questions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = questions.panorama_id 
          AND panoramas.status = 'active'
          AND panoramas.deleted_at IS NULL
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'questions_set_updated_at'
  ) THEN
    CREATE TRIGGER questions_set_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- Migration: Add Likert to question_type constraint (if table already exists)
-- Run this in Supabase SQL Editor to update existing tables
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the actual constraint name
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.questions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%question_type%'
  LIMIT 1;
  
  -- If we found a constraint, drop it
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.questions DROP CONSTRAINT %I', constraint_name);
  END IF;
  
  -- Add the new constraint with Likert included
  ALTER TABLE public.questions ADD CONSTRAINT questions_question_type_check 
    CHECK (question_type IN ('text', 'textarea', 'Single-select', 'Multi-select', 'Likert'));
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END
$$;

