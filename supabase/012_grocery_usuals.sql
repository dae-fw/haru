-- Migration: track how often each grocery item gets added, to surface a
-- one-tap "Usuals" list. Run in the Supabase SQL Editor.

create table if not exists public.haru_grocery_usual (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,          -- normalised: trimmed + lowercased
  count      int not null default 1,
  last_added timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.haru_grocery_usual enable row level security;

drop policy if exists haru_grocery_usual_owner on public.haru_grocery_usual;
create policy haru_grocery_usual_owner on public.haru_grocery_usual
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
