-- Pulse conversations table, RLS
-- Run this in Supabase SQL Editor

create table if not exists public.pulse_conversations (
  id uuid primary key default gen_random_uuid(),
  pulse_id uuid not null references public.pulses(id) on delete cascade,
  instagram_user_id text not null,
  instagram_username text,
  status text not null default 'invited' check (status in ('invited','in_progress','completed','abandoned')),
  current_question_index integer not null default 0,
  submission_id uuid not null,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(pulse_id, instagram_user_id) -- One conversation per user per pulse
);

create index if not exists pulse_conversations_pulse_id_idx on public.pulse_conversations(pulse_id);
create index if not exists pulse_conversations_instagram_user_id_idx on public.pulse_conversations(instagram_user_id);
create index if not exists pulse_conversations_status_idx on public.pulse_conversations(status);
create index if not exists pulse_conversations_submission_id_idx on public.pulse_conversations(submission_id);

alter table public.pulse_conversations enable row level security;

DO $$
BEGIN
  -- Pulse owner can view conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_conversations' AND policyname='Pulse Conversations: owner select'
  ) THEN
    CREATE POLICY "Pulse Conversations: owner select" ON public.pulse_conversations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.pulses 
          WHERE pulses.id = pulse_conversations.pulse_id 
          AND pulses.owner_id = auth.uid()
          AND pulses.deleted_at IS NULL
        )
      );
  END IF;

  -- Backend service role can insert/update conversations (for webhook handlers)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_conversations' AND policyname='Pulse Conversations: service role insert'
  ) THEN
    CREATE POLICY "Pulse Conversations: service role insert" ON public.pulse_conversations
      FOR INSERT WITH CHECK (true); -- Service role bypasses RLS
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pulse_conversations' AND policyname='Pulse Conversations: service role update'
  ) THEN
    CREATE POLICY "Pulse Conversations: service role update" ON public.pulse_conversations
      FOR UPDATE USING (true); -- Service role bypasses RLS
  END IF;
END
$$;

