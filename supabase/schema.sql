-- Haru schema — run in Supabase SQL Editor.
-- Single user, but every row is still scoped to auth.uid() via RLS.

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- projects ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#2E6E8E',
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- todos ----------
create table if not exists public.todos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null,
  project_id      uuid references public.projects (id) on delete set null,
  notes           text,
  due_date        date,
  status          text not null default 'open' check (status in ('open', 'done', 'waiting')),
  flagged         boolean not null default false,
  -- recurrence: null, or { type: 'weekly'|'monthly'|'everyN', weekdays?: int[], dayOfMonth?: int, n?: int }
  recurrence      jsonb,
  streak          int not null default 0,
  -- "waiting on someone" — parked until wake_at, then it comes back at the top
  wake_at         timestamptz,
  waiting_on      text,
  -- provenance
  source          text not null default 'app' check (source in ('app', 'capture', 'google_tasks')),
  google_tasks_id text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists todos_user_status_idx on public.todos (user_id, status);
create index if not exists todos_user_due_idx    on public.todos (user_id, due_date);

-- ---------- ideas ----------
create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null,
  project_id  uuid references public.projects (id) on delete set null,
  theme       text,
  created_at  timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists todos_updated_at on public.todos;
create trigger todos_updated_at before update on public.todos
  for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
alter table public.projects enable row level security;
alter table public.todos    enable row level security;
alter table public.ideas    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects', 'todos', 'ideas'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
         for all
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
