import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const CAL_BASE = `${CAL_API}/calendars/primary`; // create/update land on the primary calendar

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
].join(" ");

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
export const getTodayEvents = cache(async (tz: string = "UTC"): Promise<CalEvent[]> => {
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

  // 2. today's window in the viewer's timezone
  const now = new Date();
  const date = now.toLocaleDateString("en-CA", { timeZone: tz });
  const off = tzOffset(tz, now);
  const timeMin = encodeURIComponent(`${date}T00:00:00${off}`);
  const timeMax = encodeURIComponent(`${date}T23:59:59${off}`);

  // 3. fetch each calendar's events in parallel
  const perCal = await Promise.all(
    cals.map(async (c) => {
      const url = `${CAL_API}/calendars/${encodeURIComponent(
        c.id,
      )}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`;
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
});

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
