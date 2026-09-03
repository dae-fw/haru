-- Migration: checklist-style subtasks on a todo. Run in the Supabase SQL Editor.
-- Shape: [{ "id": "...", "title": "...", "done": false }]

alter table public.haru_todos
  add column if not exists subtasks jsonb not null default '[]'::jsonb;
