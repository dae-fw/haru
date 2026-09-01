# Haru

Personal productivity dashboard — todos by project, ideas, and (later) a daily planning chat.
Single user, Google login. Next.js + Supabase, deployed to Vercel at `haru.daelee.com`.

This repo is **step 1 of the build brief**: data model, CRUD, the Today / All / Capture screens,
and Google sign-in. Calendar, the Plan chat, files, and Google Tasks sync come next.

## Stack

- **Next.js 15** (App Router, server components + server actions), TypeScript, no CSS framework
- **Supabase** — Postgres + Auth (Google OAuth). Row Level Security scopes every row to the signed-in user
- **Vercel** — hosting + `haru.daelee.com`

## One-time setup

### 1. Supabase project

1. Create a project at https://supabase.com (free tier is fine).
2. In **SQL Editor**, run `supabase/schema.sql`. Optionally run `supabase/seed.sql` for starter projects.
3. **Project Settings → API**: copy `Project URL` and `anon` key into `.env.local` (see below).

### 2. Google OAuth (via Supabase)

1. Google Cloud Console → create a project → **APIs & Services → OAuth consent screen**:
   - User type: **External**, publishing status: **Testing**
   - Add your Google account as a **Test user** (no verification needed for one user)
   - Scopes: just `.../auth/userinfo.email`, `.../auth/userinfo.profile` for now
2. **Credentials → Create OAuth client ID → Web application**:
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
3. In Supabase → **Authentication → Providers → Google**: paste the Client ID + Secret, enable.
4. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://haru.daelee.com` (use `http://localhost:3000` while developing)
   - Redirect URLs: add `http://localhost:3000/**` and `https://haru.daelee.com/**`

### 3. Local env

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, HARU_ALLOWED_EMAIL
npm install
npm run dev
```

Open http://localhost:3000 → you'll hit `/login` → **Continue with Google**.
Only `HARU_ALLOWED_EMAIL` can get in; anyone else is signed out immediately.

### 4. Deploy to Vercel

1. Push this repo to GitHub, import it in Vercel.
2. Vercel → Project → **Settings → Environment Variables**: add everything from `.env.local`
   (set `NEXT_PUBLIC_SITE_URL=https://haru.daelee.com`).
3. Vercel → **Settings → Domains**: add `haru.daelee.com`, follow the DNS instructions
   (a `CNAME` on `haru` → `cname.vercel-dns.com` at your DNS host for `daelee.com`).
4. Redeploy. Then update the Supabase **Site URL / Redirect URLs** (step 2.4) to the live domain.

## Data model

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
