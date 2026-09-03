import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const CAL_BASE = `${CAL_API}/calendars/primary`; // create/update land on the primary calendar

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/tasks",
  "openid",
  "email",
].join(" ");

const TASKS_BASE = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  calendarName?: string; // set when the event is on a non-primary calendar
  htmlLink?: string;
}

interface TokenRow {
  access_token: string | null;
  refresh_token: string;
  expires_at: string | null;
}

const CONFIGURED = !!process.env.GOOGLE_CLIENT_ID;

export const isGoogleConnected = cache(async (): Promise<boolean> => {
  if (!CONFIGURED) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_google_tokens")
    .select("user_id")
    .maybeSingle();
  return !!data;
});

/** Returns a valid access token, refreshing (and persisting) if expired. Null if not connected. */
async function accessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_google_tokens")
    .select("access_token, refresh_token, expires_at")
    .maybeSingle();
  const row = data as TokenRow | null;
  if (!row) return null;

  const fresh =
    row.access_token &&
    row.expires_at &&
    new Date(row.expires_at).getTime() - 60_000 > Date.now();
  if (fresh) return row.access_token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("google token refresh failed", await res.text());
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  const expires_at = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await supabase
    .from("haru_google_tokens")
    .update({ access_token: json.access_token, expires_at })
    .not("user_id", "is", null);
  return json.access_token;
}

function normalize(
  e: {
    id: string;
    summary?: string;
    location?: string;
    htmlLink?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
  },
  calendarName?: string,
): CalEvent {
  const allDay = !e.start.dateTime;
  return {
    id: e.id,
    title: e.summary ?? "(no title)",
    start: e.start.dateTime ?? `${e.start.date}T00:00:00`,
    end: e.end.dateTime ?? `${e.end.date}T00:00:00`,
    allDay,
    location: e.location || undefined,
    calendarName,
    htmlLink: e.htmlLink,
  };
}

function tzOffset(tz: string, at: Date): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = name?.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (m) return `${m[1]}:${m[2] ?? "00"}`;
  } catch {
    /* fall through */
  }
  return "+00:00";
}

interface CalListEntry {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
}

/** Today's events across every calendar in the account that's shown in Google Calendar. */
/** Events across every visible calendar between two local dates (inclusive, YYYY-MM-DD). */
export const getEventsBetween = cache(
  async (tz: string, startDate: string, endDate: string): Promise<CalEvent[]> => {
    if (!CONFIGURED) return [];
    const token = await accessToken();
    if (!token) return [];
    const auth = { Authorization: `Bearer ${token}` };

    // 1. which calendars does this account have?
    let cals: CalListEntry[] = [{ id: "primary", primary: true }];
    const listRes = await fetch(
      `${CAL_API}/users/me/calendarList?minAccessRole=reader&fields=items(id,summary,primary,selected)`,
      { headers: auth },
    );
    if (listRes.ok) {
      const list = (await listRes.json()) as { items?: CalListEntry[] };
      const visible = (list.items ?? []).filter((c) => c.selected !== false);
      if (visible.length) cals = visible;
    } else {
      console.error("google calendarList failed", await listRes.text());
    }

    // 2. the window in the viewer's timezone
    const off = tzOffset(tz, new Date());
    const timeMin = encodeURIComponent(`${startDate}T00:00:00${off}`);
    const timeMax = encodeURIComponent(`${endDate}T23:59:59${off}`);

    // 3. fetch each calendar's events in parallel
    const perCal = await Promise.all(
      cals.map(async (c) => {
        const url = `${CAL_API}/calendars/${encodeURIComponent(
          c.id,
        )}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;
        const r = await fetch(url, { headers: auth });
        if (!r.ok) return [] as CalEvent[];
        const j = (await r.json()) as { items?: Parameters<typeof normalize>[0][] };
        const label = c.primary ? undefined : c.summary;
        return (j.items ?? []).map((e) => normalize(e, label));
      }),
    );

    // 4. merge, dedupe (a shared event shows on more than one calendar), sort
    const seen = new Set<string>();
    return perCal
      .flat()
      .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
      .sort((a, b) => a.start.localeCompare(b.start));
  },
);

const localDateInTz = (tz: string, dayOffset = 0) =>
  new Date(Date.now() + dayOffset * 86400000).toLocaleDateString("en-CA", { timeZone: tz });

export const getTodayEvents = (tz: string = "UTC") => {
  const d = localDateInTz(tz, 0);
  return getEventsBetween(tz, d, d);
};
export const getTomorrowEvents = (tz: string = "UTC") => {
  const d = localDateInTz(tz, 1);
  return getEventsBetween(tz, d, d);
};

/** For the Plan chat (step 3) and the Add-event sheet. */
export async function createCalendarEvent(input: {
  title: string;
  start: string;
  end: string;
  location?: string;
}): Promise<CalEvent | null> {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(`${CAL_BASE}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.title,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
      ...(input.location ? { location: input.location } : {}),
    }),
  });
  if (!res.ok) {
    console.error("google create event failed", await res.text());
    return null;
  }
  return normalize(await res.json());
}

/** Rename and/or reschedule an event. No delete — see build brief (too risky as a side effect). */
export async function updateCalendarEvent(
  id: string,
  input: { title?: string; start?: string; end?: string; location?: string },
): Promise<CalEvent | null> {
  const token = await accessToken();
  if (!token) return null;
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.start !== undefined) body.start = { dateTime: input.start };
  if (input.end !== undefined) body.end = { dateTime: input.end };
  if (input.location !== undefined) body.location = input.location;
  const res = await fetch(`${CAL_BASE}/events/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("google update event failed", await res.text());
    return null;
  }
  return normalize(await res.json());
}

/** @deprecated use updateCalendarEvent */
export const moveCalendarEvent = (id: string, input: { start: string; end: string }) =>
  updateCalendarEvent(id, input);

// ---------- Google Tasks (two-way, per the build brief) ----------

interface GTask {
  id: string;
  title?: string;
  due?: string; // RFC3339, date at 00:00:00Z
  status?: "needsAction" | "completed";
}

/** Import any new open Google Tasks as todos. Import only — never writes back here. */
export const syncGoogleTasks = cache(async (): Promise<void> => {
  if (!CONFIGURED) return;
  const token = await accessToken();
  if (!token) return;

  const res = await fetch(
    `${TASKS_BASE}?showCompleted=false&showHidden=false&maxResults=100`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return; // 403 = the tasks scope hasn't been granted yet — just skip
  const json = (await res.json()) as { items?: GTask[] };
  const items = (json.items ?? []).filter((t) => t.title?.trim());
  if (!items.length) return;

  const supabase = await createClient();
  // Any row already linked to a Google task — whether we imported it or pushed it —
  // so a task Haru created and mirrored out doesn't get re-imported as a duplicate.
  const { data: existing } = await supabase
    .from("haru_todos")
    .select("google_tasks_id")
    .not("google_tasks_id", "is", null);
  const have = new Set((existing ?? []).map((r) => r.google_tasks_id as string));

  const toInsert = items
    .filter((t) => !have.has(t.id))
    .map((t) => ({
      title: t.title!.trim(),
      due_date: t.due ? t.due.slice(0, 10) : null,
      status: "open" as const,
      source: "google_tasks" as const,
      google_tasks_id: t.id,
    }));
  if (toInsert.length) await supabase.from("haru_todos").insert(toInsert);
});

/** Push a Haru-created todo out to Google Tasks. Returns the new task id, or null. */
export async function createGoogleTask(input: {
  title: string;
  dueDate?: string | null;
}): Promise<string | null> {
  if (!CONFIGURED) return null;
  const token = await accessToken();
  if (!token) return null;
  const body: Record<string, unknown> = { title: input.title };
  if (input.dueDate) body.due = `${input.dueDate}T00:00:00.000Z`;
  const res = await fetch(TASKS_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const task = (await res.json()) as GTask;
  return task.id ?? null;
}

/** Keep a linked Google task's title / due date in step with edits made in Haru. */
export async function updateGoogleTask(
  taskId: string,
  patch: { title?: string; dueDate?: string | null },
): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.dueDate !== undefined) {
    body.due = patch.dueDate ? `${patch.dueDate}T00:00:00.000Z` : null;
  }
  if (Object.keys(body).length === 0) return;
  await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** Mark the linked Google Task complete when its imported todo is completed here. Never deletes. */
export async function completeGoogleTask(taskId: string): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  await fetch(`${TASKS_BASE}/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  }).catch(() => {});
}
