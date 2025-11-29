-- Pulse questions table, RLS and trigger
-- Run this in Supabase SQL Editor

create table if not exists public.pulse_questions (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid not null references public.pulses(id) on delete cascade,
  question_text text not null,
  question_type text not null check (question_type in ('text', 'Single-select')),
  options jsonb null, -- For single-select: ["Option A", "Option B", ...]
  required boolean not null default false,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pulse_questions_pulse_id_idx on public.pulse_questions(pulse_id);
create index if not exists pulse_questions_order_idx on public.pulse_questions(pulse_id, "order");

alter table public.pulse_questions enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_questions' AND policyname='Pulse Questions: owner select'
  ) THEN
    CREATE POLICY "Pulse Questions: owner select" ON public.pulse_questions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.pulses 
          WHERE pulses.id = pulse_questions.pulse_id 
          AND pulses.owner_id = auth.uid()
          AND pulses.deleted_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_questions' AND policyname='Pulse Questions: owner insert'
  ) THEN
    CREATE POLICY "Pulse Questions: owner insert" ON public.pulse_questions
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.pulses 
          WHERE pulses.id = pulse_questions.pulse_id 
          AND pulses.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_questions' AND policyname='Pulse Questions: owner update'
  ) THEN
    CREATE POLICY "Pulse Questions: owner update" ON public.pulse_questions
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.pulses 
          WHERE pulses.id = pulse_questions.pulse_id 
          AND pulses.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_questions' AND policyname='Pulse Questions: owner delete'
  ) THEN
    CREATE POLICY "Pulse Questions: owner delete" ON public.pulse_questions
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.pulses 
          WHERE pulses.id = pulse_questions.pulse_id 
          AND pulses.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

