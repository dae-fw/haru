-- Migration: a standalone grocery / shopping list, separate from todos.
-- Run in the Supabase SQL Editor.

create table if not exists public.haru_grocery (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  checked    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists haru_grocery_user_idx on public.haru_grocery (user_id, created_at);

alter table public.haru_grocery enable row level security;

drop policy if exists haru_grocery_owner on public.haru_grocery;
create policy haru_grocery_owner on public.haru_grocery
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
