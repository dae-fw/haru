-- Migration: per-task reminders + a tiny table the consolidated cron uses to
-- avoid sending the daily nudges twice. Run in the Supabase SQL Editor.

alter table public.haru_todos
  add column if not exists reminder_min int; -- minutes before due; null = no reminder
alter table public.haru_todos
  add column if not exists reminder_sent boolean not null default false;

create table if not exists public.haru_cron (
  key        text primary key,
  on_date    date,
  updated_at timestamptz not null default now()
);
-- service-role only (the cron admin client bypasses RLS); no policy = no client access
alter table public.haru_cron enable row level security;
