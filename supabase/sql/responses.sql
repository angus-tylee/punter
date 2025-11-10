-- Responses table, RLS
-- Run this in Supabase SQL Editor

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  panorama_id uuid not null references public.panoramas(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  submission_id uuid not null,
  response_text text not null,
  respondent_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists responses_panorama_id_idx on public.responses(panorama_id);
create index if not exists responses_question_id_idx on public.responses(question_id);
create index if not exists responses_submission_id_idx on public.responses(submission_id);
create index if not exists responses_created_at_idx on public.responses(created_at);

alter table public.responses enable row level security;

DO $$
BEGIN
  -- Panorama owner can view all responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='responses' AND policyname='Responses: owner select'
  ) THEN
    CREATE POLICY "Responses: owner select" ON public.responses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = responses.panorama_id 
          AND panoramas.owner_id = auth.uid()
          AND panoramas.deleted_at IS NULL
        )
      );
  END IF;

  -- Anyone can insert responses if panorama is active
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='responses' AND policyname='Responses: public insert active'
  ) THEN
    CREATE POLICY "Responses: public insert active" ON public.responses
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.panoramas 
          WHERE panoramas.id = responses.panorama_id 
          AND panoramas.status = 'active'
          AND panoramas.deleted_at IS NULL
        )
      );
  END IF;
END
$$;

