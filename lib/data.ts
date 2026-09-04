import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { syncGoogleTasks } from "@/lib/google";
import { todayISO } from "@/lib/recurrence";
import type { Idea, Project, Todo } from "@/lib/types";

// cache() dedupes within a single request — the (app) layout and the page
// can both call getOpenTodos() and it runs one query.

export const getProjects = cache(async (): Promise<Project[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_projects")
    .select("id, name, color, sort")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
});

/** Open + waiting todos, straight from the DB. */
export const getOpenTodosRaw = cache(async (): Promise<Todo[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_todos")
    .select("*")
    .in("status", ["open", "waiting"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  return (data as Todo[]) ?? [];
});

export const getOpenTodos = cache(async (): Promise<Todo[]> => {
  await syncGoogleTasks(); // pull in any new Google Tasks before we read
  return getOpenTodosRaw();
});

export const getDoneToday = cache(async (): Promise<Todo[]> => {
  const supabase = await createClient();
  const start = `${todayISO()}T00:00:00`;
  const { data } = await supabase
    .from("haru_todos")
    .select("*")
    .eq("status", "done")
    .gte("completed_at", start)
    .order("completed_at", { ascending: false });
  return (data as Todo[]) ?? [];
});

/** Todos completed on or after `startISO` (a timestamp). For the weekly review. */
export const getDoneSince = cache(async (startISO: string): Promise<Todo[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_todos")
    .select("*")
    .eq("status", "done")
    .gte("completed_at", startISO)
    .order("completed_at", { ascending: false });
  return (data as Todo[]) ?? [];
});

export const getIdeas = cache(async (): Promise<Idea[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_ideas")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Idea[]) ?? [];
});

export interface Prefs {
  palette?: "a" | "b" | "c" | null;
  theme?: "light" | "dark" | "system" | null;
  tz?: string | null;
}

/** Per-user prefs, read fresh (not from the JWT) so they sync across devices right away. */
export const getPrefs = cache(async (): Promise<Prefs | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_prefs")
    .select("palette, theme, tz")
    .maybeSingle();
  return (data as Prefs) ?? null;
});

/** Todos that belong on the Today screen: overdue, due today, flagged, or a "waiting" item whose wake time has passed. */
export function isOnToday(t: Todo, today: string = todayISO()): boolean {
  const now = new Date().toISOString();
  if (t.status === "waiting") {
    return !!t.wake_at && t.wake_at <= now;
  }
  // "later today" snooze hides it until the time passes
  if (t.snooze_until && t.snooze_until > now) return false;
  if (t.flagged) return true;
  if (t.due_date && t.due_date <= today) return true;
  return false;
}

export function isWaiting(t: Todo): boolean {
  return (
    t.status === "waiting" &&
    (!t.wake_at || t.wake_at > new Date().toISOString())
  );
}
