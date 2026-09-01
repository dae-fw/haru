# Haru

Personal productivity dashboard — todos by project, ideas, and (later) a daily planning chat.
Single user, email + password login. Next.js + Supabase, deployed to Vercel at `haru.daelee.com`.

This repo is **step 1 of the build brief**: data model, CRUD, the Today / All / Capture screens,
and sign-in. Calendar, the Plan chat, files, and Google Tasks sync come next.

## Stack

- **Next.js 16** (App Router, server components + server actions), TypeScript, no CSS framework
- **Supabase** — Postgres + Auth (email + password). Row Level Security scopes every row to the signed-in user
- **Vercel** — hosting + `haru.daelee.com`

> **Login is email + password**, not Google OAuth — so Haru can share an existing Supabase
> project without touching its Auth → Providers config. Google is only needed later for
> **Calendar API access** (step 2), which is a separate standalone OAuth token flow and does
> not affect how you log in.

## One-time setup

### 1. Supabase project

You can **reuse an existing Supabase project**. Haru's tables live in the default `public`
schema with a `haru_` prefix (`haru_projects`, `haru_todos`, `haru_ideas`), so they won't
collide with anything already there and there's **no "Exposed schemas" setting to touch**.

1. Create a project at https://supabase.com, or pick an existing one (free tier includes 2 projects).
2. In **SQL Editor**, run `supabase/schema.sql` (tables + RLS). Optionally run `supabase/seed.sql`.
3. **Project Settings → API**: copy `Project URL` and `anon` key into `.env.local` (see below).

The `haru_` table prefix means this is safe to run in a project that other apps already use.
Shared `auth.users` is fine — the `HARU_ALLOWED_EMAIL` gate keeps Haru single-user.

> Ran an earlier version that made a `haru` schema? Drop it with
> `drop schema if exists haru cascade;` before running the current `schema.sql`.

### 2. Create your login

Email + password auth is on by default in every Supabase project — nothing to configure.

1. Supabase → **Authentication → Users → Add user**:
   - Email: the same address as `HARU_ALLOWED_EMAIL`
   - Set a password, and tick **Auto Confirm User**
2. Supabase → **Authentication → Providers → Email**: make sure "Confirm email" is **off**
   (or just rely on Auto Confirm above). No SMTP needed.

That's the whole auth setup. No Google Cloud project, no OAuth client, no redirect URLs.

### 3. Local env

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, HARU_ALLOWED_EMAIL
npm install
npm run dev
```

Open http://localhost:3000 → `/login` → sign in with the email + password you created.
Only `HARU_ALLOWED_EMAIL` gets past the gate; any other account is signed out immediately.

### 4. Deploy to Vercel

1. Push this repo to GitHub, import it in Vercel.
2. Vercel → Project → **Settings → Environment Variables**: add everything from `.env.local`
   (set `NEXT_PUBLIC_SITE_URL=https://haru.daelee.com`).
3. Vercel → **Settings → Domains**: add `haru.daelee.com`, follow the DNS instructions
   (a `CNAME` on `haru` → `cname.vercel-dns.com` at your DNS host for `daelee.com`).
4. Redeploy. In Supabase → **Authentication → URL Configuration**, set **Site URL** to
   `https://haru.daelee.com` (used for password-reset links etc.).

## Data model

Tables are in `public`, prefixed `haru_` (`haru_projects`, `haru_todos`, `haru_ideas`).

- **projects** — `name`, `color`, `sort`
- **todos** — `title`, `project_id`, `notes`, `due_date`, `status` (`open` / `done` / `waiting`),
  `flagged`, `recurrence` (jsonb), `streak`, `wake_at`, `waiting_on`, `source`, `google_tasks_id`
- **ideas** — `body`, `project_id`, `theme` — a dumping ground, no status, no due date

Recurrence rule shape (`todos.recurrence`):

```jsonc
{ "type": "weekly",  "weekdays": [2, 4] }   // Tue, Thu  (0 = Sun)
{ "type": "monthly", "dayOfMonth": 15 }
{ "type": "everyN",  "n": 3 }               // every 3 days
```

Completing a recurring todo marks it done and inserts the next instance (see `lib/recurrence.ts`).
"Skip this one" advances the schedule without resetting `streak`.
