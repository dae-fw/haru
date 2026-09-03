-- Haru schema — run in the Supabase SQL Editor.
--
-- Tables live in the default `public` schema with a `haru_` prefix, so this can
-- share a Supabase project with other apps without name collisions and without
-- needing to change any "Exposed schemas" setting in the dashboard.

-- ---------- updated_at helper ----------
create or replace function public.haru_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- projects ----------
create table if not exists public.haru_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#2E6E8E',
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- todos ----------
create table if not exists public.haru_todos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null,
  project_id      uuid references public.haru_projects (id) on delete set null,
  notes           text,
  due_date        date,
  due_time        text,  -- "HH:MM" 24h, optional
  status          text not null default 'open' check (status in ('open', 'done', 'waiting')),
  flagged         boolean not null default false,
  -- recurrence: null, or { type: 'weekly'|'monthly'|'everyN', weekdays?: int[], dayOfMonth?: int, n?: int }
  recurrence      jsonb,
  streak          int not null default 0,
  -- "waiting on someone" — parked until wake_at, then it comes back at the top
  wake_at         timestamptz,
  waiting_on      text,
  -- "later today" snooze — hidden from Today until this time, status stays 'open'
  snooze_until    timestamptz,
  -- checklist subtasks: [{id, title, done}]
  subtasks        jsonb not null default '[]'::jsonb,
  -- provenance
  source          text not null default 'app' check (source in ('app', 'capture', 'google_tasks')),
  google_tasks_id text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists haru_todos_user_status_idx on public.haru_todos (user_id, status);
create index if not exists haru_todos_user_due_idx    on public.haru_todos (user_id, due_date);

-- ---------- ideas ----------
create table if not exists public.haru_ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null,
  project_id  uuid references public.haru_projects (id) on delete set null,
  theme       text,
  created_at  timestamptz not null default now()
);

-- ---------- google calendar token (separate from login) ----------
create table if not exists public.haru_google_tokens (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  access_token  text,
  refresh_token text not null,
  scope         text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- web-push subscriptions ----------
create table if not exists public.haru_push_subs (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists haru_push_subs_user_idx on public.haru_push_subs (user_id);

-- ---------- per-user prefs (synced across devices, read fresh not from JWT) ----------
create table if not exists public.haru_prefs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  palette    text,
  theme      text,
  tz         text,
  updated_at timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
drop trigger if exists haru_projects_updated_at on public.haru_projects;
create trigger haru_projects_updated_at before update on public.haru_projects
  for each row execute function public.haru_set_updated_at();

drop trigger if exists haru_todos_updated_at on public.haru_todos;
create trigger haru_todos_updated_at before update on public.haru_todos
  for each row execute function public.haru_set_updated_at();

drop trigger if exists haru_google_tokens_updated_at on public.haru_google_tokens;
create trigger haru_google_tokens_updated_at before update on public.haru_google_tokens
  for each row execute function public.haru_set_updated_at();

-- ---------- Row Level Security ----------
alter table public.haru_projects       enable row level security;
alter table public.haru_todos          enable row level security;
alter table public.haru_ideas          enable row level security;
alter table public.haru_google_tokens  enable row level security;
alter table public.haru_push_subs      enable row level security;
alter table public.haru_prefs          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['haru_projects', 'haru_todos', 'haru_ideas', 'haru_google_tokens', 'haru_push_subs', 'haru_prefs'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
         for all
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
