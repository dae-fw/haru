import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary";

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
  htmlLink?: string;
}

interface TokenRow {
  access_token: string | null;
  refresh_token: string;
  expires_at: string | null;
}

export const isGoogleConnected = cache(async (): Promise<boolean> => {
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

function normalize(e: {
  id: string;
  summary?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}): CalEvent {
  const allDay = !e.start.dateTime;
  return {
    id: e.id,
    title: e.summary ?? "(no title)",
    start: e.start.dateTime ?? `${e.start.date}T00:00:00`,
    end: e.end.dateTime ?? `${e.end.date}T00:00:00`,
    allDay,
    htmlLink: e.htmlLink,
  };
}

export const getTodayEvents = cache(async (): Promise<CalEvent[]> => {
  const token = await accessToken();
  if (!token) return [];
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const url = `${CAL_BASE}/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(
    end,
  )}&singleEvents=true&orderBy=startTime&maxResults=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error("google events fetch failed", await res.text());
    return [];
  }
  const json = (await res.json()) as { items?: Parameters<typeof normalize>[0][] };
  return (json.items ?? []).map(normalize);
});

/** For the Plan chat (step 3). */
export async function createCalendarEvent(input: {
  title: string;
  start: string;
  end: string;
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
    }),
  });
  if (!res.ok) {
    console.error("google create event failed", await res.text());
    return null;
  }
  return normalize(await res.json());
}

export async function moveCalendarEvent(
  id: string,
  input: { start: string; end: string },
): Promise<CalEvent | null> {
  const token = await accessToken();
  if (!token) return null;
  const res = await fetch(`${CAL_BASE}/events/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      start: { dateTime: input.start },
      end: { dateTime: input.end },
    }),
  });
  if (!res.ok) {
    console.error("google move event failed", await res.text());
    return null;
  }
  return normalize(await res.json());
}
