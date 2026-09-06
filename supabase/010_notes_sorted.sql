-- Migration: a jotted thought is "unsorted" until Organize's Thoughts pass
-- decides what to do with it. Existing notes are treated as already sorted so
-- the backlog doesn't flood Organize on first run.

alter table public.haru_ideas
  add column if not exists sorted boolean not null default false;

update public.haru_ideas set sorted = true where sorted = false;
