-- Migration: reference notes — permanent facts the chat can draw on
-- ("Tenant rent: 1st of month, $2,400. Lease ends Aug 2026.").
-- Run in the Supabase SQL Editor.

create table if not exists public.haru_reference (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label      text,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists haru_reference_user_idx on public.haru_reference (user_id, updated_at desc);

alter table public.haru_reference enable row level security;

drop policy if exists haru_reference_owner on public.haru_reference;
create policy haru_reference_owner on public.haru_reference
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists haru_reference_updated_at on public.haru_reference;
create trigger haru_reference_updated_at before update on public.haru_reference
  for each row execute function public.haru_set_updated_at();
