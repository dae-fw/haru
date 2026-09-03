"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { nextDueDate, toISODate } from "@/lib/recurrence";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/google";
import type { Recurrence, Todo } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/all");
  revalidatePath("/capture");
}

export async function addTodo(formData: FormData) {
  const { user, supabase } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const projectId = String(formData.get("project_id") ?? "") || null;
  const due = String(formData.get("due_date") ?? "") || null;
  const flagged = formData.get("flagged") === "on";

  let recurrence: unknown = null;
  const recRaw = String(formData.get("recurrence") ?? "");
  if (recRaw) {
    try {
      const r = JSON.parse(recRaw);
      if (r && typeof r.type === "string") recurrence = r;
    } catch {
      /* ignore */
    }
  }

  await supabase.from("haru_todos").insert({
    user_id: user.id,
    title,
    project_id: projectId,
    due_date: due,
    flagged,
    recurrence,
  });
  revalidateAll();
}

export async function completeTodo(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("haru_todos").select("*").eq("id", id).single();
  const todo = data as Todo | null;
  if (!todo) return;

  await supabase
    .from("haru_todos")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id);

  // Recurring -> spawn the next instance, carry the streak forward (+1).
  if (todo.recurrence) {
    const base = todo.due_date ?? toISODate(new Date());
    await supabase.from("haru_todos").insert({
      user_id: todo.user_id,
      title: todo.title,
      project_id: todo.project_id,
      notes: todo.notes,
      due_date: nextDueDate(todo.recurrence as Recurrence, base),
      flagged: todo.flagged,
      recurrence: todo.recurrence,
      streak: (todo.streak ?? 0) + 1,
      source: todo.source,
    });
  }
  revalidateAll();
}

export async function reopenTodo(id: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("haru_todos")
    .update({ status: "open", completed_at: null })
    .eq("id", id);
  revalidateAll();
}

/** "Skip this one" for a recurring todo: jump to the next instance, keep the streak. */
export async function skipRecurrence(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("haru_todos").select("*").eq("id", id).single();
  const todo = data as Todo | null;
  if (!todo?.recurrence) return;

  const base = todo.due_date ?? toISODate(new Date());
  await supabase
    .from("haru_todos")
    .update({ due_date: nextDueDate(todo.recurrence as Recurrence, base) })
    .eq("id", id);
  revalidateAll();
}

export async function rescheduleTodo(id: string, dueDate: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("haru_todos")
    .update({
      due_date: dueDate,
      status: "open",
      wake_at: null,
      waiting_on: null,
      snooze_until: null,
    })
    .eq("id", id);
  revalidateAll();
}

/** "Later today" — hide from Today until a timestamp, keep status open. */
export async function snoozeTodo(id: string, untilISO: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("haru_todos")
    .update({ snooze_until: untilISO, status: "open" })
    .eq("id", id);
  revalidateAll();
}

export async function setRecurrence(id: string, recurrence: Recurrence | null) {
  const { supabase } = await requireUser();
  await supabase.from("haru_todos").update({ recurrence }).eq("id", id);
  revalidateAll();
}

/** Park a task you've chased. It leaves Today until wake_at, then returns at the top. */
export async function parkTodo(id: string, wakeAtISO: string, waitingOn: string | null) {
  const { supabase } = await requireUser();
  await supabase
    .from("haru_todos")
    .update({ status: "waiting", wake_at: wakeAtISO, waiting_on: waitingOn })
    .eq("id", id);
  revalidateAll();
}

export async function unparkTodo(id: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("haru_todos")
    .update({ status: "open", wake_at: null })
    .eq("id", id);
  revalidateAll();
}

export async function updateTodo(
  id: string,
  patch: {
    title?: string;
    project_id?: string | null;
    due_date?: string | null;
    flagged?: boolean;
    notes?: string | null;
    subtasks?: { id: string; title: string; done: boolean }[];
  },
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (t) update.title = t;
  }
  if (patch.project_id !== undefined) update.project_id = patch.project_id || null;
  if (patch.due_date !== undefined) update.due_date = patch.due_date || null;
  if (patch.flagged !== undefined) update.flagged = patch.flagged;
  if (patch.subtasks !== undefined) {
    update.subtasks = patch.subtasks
      .filter((s) => s.title.trim())
      .map((s) => ({ id: s.id, title: s.title.trim(), done: !!s.done }));
  }
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (Object.keys(update).length === 0) return;
  await supabase.from("haru_todos").update(update).eq("id", id);
  revalidateAll();
}

export async function toggleSubtask(todoId: string, subId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("haru_todos")
    .select("subtasks")
    .eq("id", todoId)
    .single();
  const subs = ((data?.subtasks ?? []) as { id: string; title: string; done: boolean }[]).map(
    (s) => (s.id === subId ? { ...s, done: !s.done } : s),
  );
  await supabase.from("haru_todos").update({ subtasks: subs }).eq("id", todoId);
  revalidateAll();
}

export async function toggleFlag(id: string, flagged: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("haru_todos").update({ flagged }).eq("id", id);
  revalidateAll();
}

export async function addIdea(formData: FormData) {
  const { user, supabase } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await supabase.from("haru_ideas").insert({ user_id: user.id, body });
  revalidateAll();
}

export async function promoteIdea(id: string) {
  const { user, supabase } = await requireUser();
  const { data: idea } = await supabase
    .from("haru_ideas")
    .select("*")
    .eq("id", id)
    .single();
  if (!idea) return;
  await supabase.from("haru_todos").insert({
    user_id: user.id,
    title: idea.body,
    project_id: idea.project_id,
    source: "capture",
  });
  await supabase.from("haru_ideas").delete().eq("id", id);
  revalidateAll();
}

export async function deleteIdea(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("haru_ideas").delete().eq("id", id);
  revalidateAll();
}

/** Create a calendar event from the app. */
export async function createEvent(input: {
  title: string;
  start: string;
  end: string;
  location?: string;
}) {
  await requireUser();
  const ok = await createCalendarEvent(input);
  if (ok) revalidateAll();
  return !!ok;
}

/** Rename / reschedule a calendar event from the app. No delete — see build brief. */
export async function updateEvent(
  id: string,
  patch: { title?: string; start?: string; end?: string; location?: string },
) {
  await requireUser();
  const ok = await updateCalendarEvent(id, patch);
  if (ok) revalidateAll();
  return !!ok;
}

export async function disconnectGoogle() {
  const { supabase } = await requireUser();
  await supabase.from("haru_google_tokens").delete().not("user_id", "is", null);
  revalidatePath("/");
  revalidatePath("/settings");
}

/** Palette + theme live in haru_prefs (read fresh on every load) so a change on
 *  one device shows on all of them without waiting for a token refresh. */
export async function setAppearance(patch: {
  palette?: "a" | "b" | "c";
  theme?: "light" | "dark" | "system";
}) {
  const { user, supabase } = await requireUser();
  await supabase
    .from("haru_prefs")
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}

/** Timezone also lives in haru_prefs — the cron reads it there. */
export async function saveTimeZone(tz: string) {
  if (tz !== "UTC" && !/^[A-Za-z_]+\/[A-Za-z0-9_+-]+/.test(tz)) return;
  const { user, supabase } = await requireUser();
  await supabase
    .from("haru_prefs")
    .upsert({ user_id: user.id, tz, updated_at: new Date().toISOString() });
}

export async function setNickname(formData: FormData) {
  const { user, supabase } = await requireUser();
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 40);
  const current = (user.user_metadata ?? {}) as Record<string, unknown>;
  await supabase.auth.updateUser({ data: { ...current, nickname: nickname || null } });
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function addProject(formData: FormData) {
  const { user, supabase } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const color = String(formData.get("color") ?? "#2E6E8E");
  await supabase.from("haru_projects").insert({ user_id: user.id, name, color });
  revalidatePath("/settings");
  revalidateAll();
}
