-- Migration: web-push subscriptions. Run in the Supabase SQL Editor.

create table if not exists public.haru_push_subs (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists haru_push_subs_user_idx on public.haru_push_subs (user_id);

alter table public.haru_push_subs enable row level security;

drop policy if exists haru_push_subs_owner on public.haru_push_subs;
create policy haru_push_subs_owner on public.haru_push_subs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
