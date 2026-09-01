-- Haru schema — run in the Supabase SQL Editor.
-- Everything lives in a dedicated `haru` schema so this can share a Supabase
-- project with other apps without colliding on table names.
--
-- AFTER running this: Dashboard -> Project Settings -> API -> "Exposed schemas"
-- and add `haru` to the list (next to `public`). The app talks to it via
-- db: { schema: "haru" } in the Supabase client config.

create schema if not exists haru;

grant usage on schema haru to anon, authenticated, service_role;
alter default privileges in schema haru
  grant all on tables to anon, authenticated, service_role;

-- ---------- updated_at helper ----------
create or replace function haru.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- projects ----------
create table if not exists haru.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#2E6E8E',
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- todos ----------
create table if not exists haru.todos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null,
  project_id      uuid references haru.projects (id) on delete set null,
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
create index if not exists todos_user_status_idx on haru.todos (user_id, status);
create index if not exists todos_user_due_idx    on haru.todos (user_id, due_date);

-- ---------- ideas ----------
create table if not exists haru.ideas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null,
  project_id  uuid references haru.projects (id) on delete set null,
  theme       text,
  created_at  timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
drop trigger if exists projects_updated_at on haru.projects;
create trigger projects_updated_at before update on haru.projects
  for each row execute function haru.set_updated_at();

drop trigger if exists todos_updated_at on haru.todos;
create trigger todos_updated_at before update on haru.todos
  for each row execute function haru.set_updated_at();

-- ---------- Row Level Security ----------
alter table haru.projects enable row level security;
alter table haru.todos    enable row level security;
alter table haru.ideas    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects', 'todos', 'ideas'] loop
    execute format('drop policy if exists %I_owner on haru.%I', t, t);
    execute format(
      'create policy %I_owner on haru.%I
         for all
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
