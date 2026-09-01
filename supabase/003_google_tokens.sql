-- Migration: store the Google Calendar OAuth token (separate from login).
-- Run in the Supabase SQL Editor. Safe to run more than once.

create table if not exists public.haru_google_tokens (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  access_token  text,
  refresh_token text not null,
  scope         text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.haru_google_tokens enable row level security;

drop policy if exists haru_google_tokens_owner on public.haru_google_tokens;
create policy haru_google_tokens_owner on public.haru_google_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
