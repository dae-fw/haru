-- Migration: per-user preferences that must sync across devices immediately
-- (palette, theme, timezone). Read fresh on every load — not from the JWT.

create table if not exists public.haru_prefs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  palette    text,
  theme      text,
  tz         text,
  updated_at timestamptz not null default now()
);

alter table public.haru_prefs enable row level security;

drop policy if exists haru_prefs_owner on public.haru_prefs;
create policy haru_prefs_owner on public.haru_prefs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
