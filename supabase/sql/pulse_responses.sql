-- Pulse responses table, RLS
-- Run this in Supabase SQL Editor

create table if not exists public.pulse_responses (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid not null references public.pulses(id) on delete cascade,
  question_id uuid not null references public.pulse_questions(id) on delete cascade,
  submission_id uuid not null, -- Links all responses from one conversation
  instagram_user_id text not null, -- Instagram user ID
  instagram_username text, -- Instagram username (if available)
  response_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists pulse_responses_pulse_id_idx on public.pulse_responses(pulse_id);
create index if not exists pulse_responses_question_id_idx on public.pulse_responses(question_id);
create index if not exists pulse_responses_submission_id_idx on public.pulse_responses(submission_id);
create index if not exists pulse_responses_created_at_idx on public.pulse_responses(created_at);
create index if not exists pulse_responses_instagram_user_id_idx on public.pulse_responses(instagram_user_id);

alter table public.pulse_responses enable row level security;

DO $$
BEGIN
  -- Pulse owner can view all responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_responses' AND policyname='Pulse Responses: owner select'
  ) THEN
    CREATE POLICY "Pulse Responses: owner select" ON public.pulse_responses
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.pulses 
          WHERE pulses.id = pulse_responses.pulse_id 
          AND pulses.owner_id = auth.uid()
          AND pulses.deleted_at IS NULL
        )
      );
  END IF;

  -- Backend service role can insert responses (for webhook handlers)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_responses' AND policyname='Pulse Responses: service role insert'
  ) THEN
    CREATE POLICY "Pulse Responses: service role insert" ON public.pulse_responses
      FOR INSERT WITH CHECK (true); -- Service role bypasses RLS
  END IF;
END
$$;

