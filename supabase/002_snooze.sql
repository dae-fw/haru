-- Migration: add "later today" snooze to todos.
-- Run this if you already ran an earlier schema.sql. Safe to run more than once.

alter table public.haru_todos
  add column if not exists snooze_until timestamptz;
