import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/recurrence";
import type { Idea, Project, Todo } from "@/lib/types";

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_projects")
    .select("id, name, color, sort")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getOpenTodos(): Promise<Todo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_todos")
    .select("*")
    .in("status", ["open", "waiting"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  return (data as Todo[]) ?? [];
}

export async function getDoneToday(): Promise<Todo[]> {
  const supabase = await createClient();
  const start = `${todayISO()}T00:00:00`;
  const { data } = await supabase
    .from("haru_todos")
    .select("*")
    .eq("status", "done")
    .gte("completed_at", start)
    .order("completed_at", { ascending: false });
  return (data as Todo[]) ?? [];
}

export async function getIdeas(): Promise<Idea[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("haru_ideas")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Idea[]) ?? [];
}

/** Todos that belong on the Today screen: overdue, due today, flagged, or a "waiting" item whose wake time has passed. */
export function isOnToday(t: Todo): boolean {
  const today = todayISO();
  if (t.status === "waiting") {
    return !!t.wake_at && t.wake_at <= new Date().toISOString();
  }
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
