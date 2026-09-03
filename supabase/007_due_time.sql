-- Migration: optional time-of-day on a todo, stored as "HH:MM" (24h) or null.
-- Kept separate from due_date (a plain date) so date comparisons stay simple.

alter table public.haru_todos
  add column if not exists due_time text;
