# Personal Dashboard Agent — Build Brief

## What this is
A personal productivity dashboard with todos organized by company/project, calendar integration, and a daily AI conversation to plan the day, cross off todos, and reschedule things. Single user, no auth complexity beyond one Google login.

## Stack
- **Frontend:** Next.js (React), deployed to Vercel
- **Auth:** Google OAuth (Calendar + Drive scopes)
- **Database:** Postgres via Supabase
- **AI:** Anthropic API
  - Claude Haiku 4.5 for: file categorization, todo parsing, quick classification tasks
  - Claude Sonnet for: the daily planning conversation (needs to reason across calendar + todos + priorities)
- **File handling:** Google Drive API only (no iCloud — no public API available)
- **Mobile:** PWA (add to home screen), not a native app

## Build order
1. **Data model + CRUD, no auth, no AI**
   - Entities: Company/Project, Todo (title, project_id, due_date, status, notes, recurrence_rule), maybe Tag
   - **Recurrence**: a Todo can optionally repeat (e.g. "every 15th of the month"). Store as a simple rule (day-of-month, weekly, etc.), not a full calendar RRULE spec unless you actually need that complexity. When a recurring todo is completed, generate the next instance automatically rather than trying to "uncomplete" and reset the same row
   - **Idea** (title, body, created_date, optional project_id) — a dumping ground for random thoughts, not tied to a due date or a project by default. This is deliberately unstructured: no status, no priority. If an idea turns into real work later, you convert it into a Todo manually, don't try to auto-promote it
   - Basic dashboard UI: todos grouped by project, ability to add/edit/complete/reschedule a todo, plus a separate "Ideas" area (not mixed into the project todo lists) for quick capture
   - Get this fully working locally before touching Google or Claude

2. **Google Calendar integration**
   - OAuth flow, with write access from the start (`calendar.events` scope, not read-only) — need to create and move events, not just view them
   - Pull today's events into the dashboard view
   - Calendar functions the AI can call in step 3: `create_event`, `move_event` — same pattern as `complete_todo`/`reschedule_todo`
   - No `delete_event` — too risky to let the model remove something silently as a side effect of a broader instruction. If you want deletion later, do it manually in Google Calendar directly, not through the AI

3. **Claude API — daily conversation**
   - Backend endpoint that assembles context: today's todos across all projects + today's calendar events
   - Sends to Sonnet with a system prompt like "help the user plan their day, surface conflicts, ask what to prioritize"
   - Chat UI for the conversation, with ability for the model to call functions like `complete_todo(id)`, `reschedule_todo(id, new_date)`, `create_event`, `move_event`
   - Prioritization logic — don't leave this to the model to guess, define it explicitly in the system prompt:
     1. Overdue todos first
     2. Todos due today
     3. Todos tied to a project with an event happening today
     4. Anything manually flagged high priority
     - Surface this as a ranked list at the start of the conversation, then let the user redirect from there

4. **File drag-and-drop + auto-sort (Google Drive only)**
   - Upload to Drive via API
   - For scanned PDFs/images, use Drive's built-in OCR to extract text before classifying — don't rely on filename alone
   - Haiku call classifies the file against your defined project rules (keyword/filename based to start — don't over-engineer this into freeform inference)
   - File gets moved/tagged accordingly, user can override

4b. **Snap-a-note capture**
   - Camera/photo upload button in the dashboard (mobile-friendly, since this is the on-the-go use case)
   - Send the image directly to Claude (Haiku) — no separate OCR service needed, Claude reads text from images natively
   - Extracted text gets classified the same way as step 4: sorted into a project Todo if it clearly matches one, otherwise dropped into Ideas by default
   - Always show the extracted text for confirmation before filing it — OCR/handwriting misreads happen, don't auto-file blind

5. **Google Tasks sync**
   - Read/write access via Google Tasks API (separate scope from Calendar)
   - **Import (automatic)**: any new Google Task syncs into the dashboard automatically as a Todo — no manual "absorb" button needed, this direction is safe since it's just pulling everything in, not guessing at matches
   - **Writeback (on completion)**: when the imported Todo is marked done in the dashboard, mark the original Google Task complete — do NOT delete it. Deleting is unrecoverable if a sync bug double-imports or mismatches something; marking complete is reversible and keeps Google Tasks as an accurate record if you ever check it directly on your phone
   - No fuzzy title-matching between unrelated Google Tasks and dashboard Todos — only items that came from the sync get writeback treatment

6. **Morning nudge (optional, do last)**
   - Cron job (Vercel Cron or Supabase scheduled function) preps the day's context
   - Push notification or email trigger, since there's no way to "auto-open" the app for you
   - **Push notification caveat**: PWA push works reliably on Android/desktop. On iPhone it only works if the app has been added to the home screen first, and is generally less reliable than a native app's notifications. Don't assume parity with iOS native push — test this early if it matters, don't leave it for the end

7. **Goodnight routine (optional, same pattern as morning)**
   - Second conversation entry point, reuses the same context-assembly logic as step 3
   - Recap: what got done today, what's rolling to tomorrow
   - Occasionally surface one old idea from the Ideas dumping ground (pairs with the weekly idea-resurfacing feature)

## Explicit constraints / things not to build
- No iCloud integration — not possible via public API
- No native iOS/Android app — PWA only, revisit only if PWA genuinely fails
- No multi-user, teams, or permissions — single user only
- No freeform "infer my whole filing system" AI — start with explicit rules, loosen only after it's proven reliable
- Don't default to Haiku everywhere — reasoning-heavy conversation needs Sonnet; only high-volume/simple tasks (parsing, sorting) should use Haiku

## Environment / secrets needed
- `ANTHROPIC_API_KEY`
- Google OAuth client ID/secret (Cloud Console project with Calendar + Drive API enabled)
- Supabase project URL + service key
