"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { nextDueDate, toISODate } from "@/lib/recurrence";
import {
  completeGoogleTask,
  createCalendarEvent,
  createGoogleTask,
  updateCalendarEvent,
  updateGoogleTask,
} from "@/lib/google";
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
  const dueTime = String(formData.get("due_time") ?? "").trim() || null;
  const flagged = formData.get("flagged") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const remRaw = String(formData.get("reminder_min") ?? "").trim();
  const reminderMin = due && remRaw !== "" ? Number(remRaw) : null;

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

  const { data: inserted } = await supabase
    .from("haru_todos")
    .insert({
      user_id: user.id,
      title,
      project_id: projectId,
      due_date: due,
      due_time: due ? dueTime : null,
      notes,
      reminder_min: Number.isFinite(reminderMin) ? reminderMin : null,
      flagged,
      recurrence,
    })
    .select("id")
    .single();

  revalidateAll();

  // Mirror it out to Google Tasks after the response — never blocks the add.
  if (inserted?.id) {
    after(async () => {
      const gid = await createGoogleTask({ title, dueDate: due });
      if (gid) {
        await supabase
          .from("haru_todos")
          .update({ google_tasks_id: gid })
          .eq("id", inserted.id);
      }
    });
  }
}

/** Plain-args todo create — used by the Plan chat's add_todo tool. */
export async function addTodoFields(input: {
  title: string;
  dueDate?: string | null;
  projectId?: string | null;
  flagged?: boolean;
}) {
  const { user, supabase } = await requireUser();
  const title = input.title.trim();
  if (!title) return;
  const due = input.dueDate || null;

  const { data: inserted } = await supabase
    .from("haru_todos")
    .insert({
      user_id: user.id,
      title,
      project_id: input.projectId || null,
      due_date: due,
      flagged: !!input.flagged,
    })
    .select("id")
    .single();

  revalidateAll();

  if (inserted?.id) {
    after(async () => {
      const gid = await createGoogleTask({ title, dueDate: due });
      if (gid) {
        await supabase
          .from("haru_todos")
          .update({ google_tasks_id: gid })
          .eq("id", inserted.id);
      }
    });
  }
}

// ---------- bulk actions (All screen multi-select) ----------

export async function bulkReschedule(ids: string[], dueDate: string) {
  const { supabase } = await requireUser();
  if (!ids.length) return;
  await supabase
    .from("haru_todos")
    .update({
      due_date: dueDate,
      status: "open",
      wake_at: null,
      waiting_on: null,
      snooze_until: null,
    })
    .in("id", ids);
  revalidateAll();
}

export async function bulkSetProject(ids: string[], projectId: string | null) {
  const { supabase } = await requireUser();
  if (!ids.length) return;
  await supabase.from("haru_todos").update({ project_id: projectId }).in("id", ids);
  revalidateAll();
}

export async function bulkDelete(ids: string[]) {
  const { supabase } = await requireUser();
  if (!ids.length) return;
  await supabase.from("haru_todos").delete().in("id", ids);
  revalidateAll();
}

/** Complete each (spawns recurrences, writes back to Google) — used with a batch undo. */
export async function bulkComplete(ids: string[]) {
  for (const id of ids) await completeTodo(id);
}

export async function bulkReopen(ids: string[]) {
  const { supabase } = await requireUser();
  if (!ids.length) return;
  await supabase
    .from("haru_todos")
    .update({ status: "open", completed_at: null })
    .in("id", ids);
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
  // A paused recurrence stays put — completing it doesn't regenerate.
  if (todo.recurrence && !(todo.recurrence as Recurrence).paused) {
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

  // Writeback: an imported Google Task gets marked complete in Google too (never deleted).
  if (todo.source === "google_tasks" && todo.google_tasks_id) {
    await completeGoogleTask(todo.google_tasks_id);
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

/** Stop generating new instances; keep the schedule + streak. */
export async function pauseRecurrence(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("haru_todos").select("recurrence").eq("id", id).single();
  const rec = data?.recurrence as Recurrence | null;
  if (!rec) return;
  await supabase
    .from("haru_todos")
    .update({ recurrence: { ...rec, paused: true } })
    .eq("id", id);
  revalidateAll();
}

/** Resume; move the due date to the next scheduled occurrence (or today if that's past). */
export async function resumeRecurrence(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("haru_todos")
    .select("recurrence, due_date")
    .eq("id", id)
    .single();
  const rec = data?.recurrence as Recurrence | null;
  if (!rec) return;
  const { paused, ...active } = rec;
  void paused;
  const todayStr = toISODate(new Date());
  let d = (data?.due_date as string | null) ?? todayStr;
  let guard = 0;
  while (d < todayStr && guard++ < 400) d = nextDueDate(active as Recurrence, d);
  await supabase
    .from("haru_todos")
    .update({ recurrence: active, due_date: d, status: "open" })
    .eq("id", id);
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
    due_time?: string | null;
    flagged?: boolean;
    notes?: string | null;
    subtasks?: { id: string; title: string; done: boolean }[];
    reminder_min?: number | null;
  },
) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (t) update.title = t;
  }
  if (patch.project_id !== undefined) update.project_id = patch.project_id || null;
  if (patch.due_date !== undefined) {
    update.due_date = patch.due_date || null;
    if (!patch.due_date) {
      update.due_time = null; // no date -> no time
      update.reminder_min = null; // ...and no reminder
    }
  }
  if (patch.due_time !== undefined) update.due_time = patch.due_time || null;
  if (patch.reminder_min !== undefined)
    update.reminder_min = patch.reminder_min == null ? null : patch.reminder_min;
  // any schedule change re-arms the reminder
  if (
    patch.due_date !== undefined ||
    patch.due_time !== undefined ||
    patch.reminder_min !== undefined
  ) {
    update.reminder_sent = false;
  }
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

  // Keep a linked Google task's title / due date in step — after the response.
  if (update.title !== undefined || update.due_date !== undefined) {
    after(async () => {
      const { data: row } = await supabase
        .from("haru_todos")
        .select("google_tasks_id")
        .eq("id", id)
        .single();
      if (row?.google_tasks_id) {
        await updateGoogleTask(row.google_tasks_id as string, {
          ...(update.title !== undefined ? { title: update.title as string } : {}),
          ...(update.due_date !== undefined
            ? { dueDate: (update.due_date as string | null) ?? null }
            : {}),
        });
      }
    });
  }
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

/** Convert a todo back into a loose idea (removes the todo). */
export async function demoteToIdea(todoId: string) {
  const { user, supabase } = await requireUser();
  const { data } = await supabase
    .from("haru_todos")
    .select("title, notes, project_id")
    .eq("id", todoId)
    .single();
  if (!data) return;
  const body = [data.title, data.notes].filter(Boolean).join(" — ");
  await supabase.from("haru_ideas").insert({
    user_id: user.id,
    body,
    project_id: data.project_id ?? null,
  });
  await supabase.from("haru_todos").delete().eq("id", todoId);
  revalidateAll();
}

export async function deleteTodo(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("haru_todos").delete().eq("id", id);
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

export async function updateIdea(id: string, body: string) {
  const { supabase } = await requireUser();
  const b = body.trim();
  if (!b) return;
  await supabase.from("haru_ideas").update({ body: b }).eq("id", id);
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

export async function updateProject(id: string, patch: { name?: string; color?: string }) {
  const { supabase } = await requireUser();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (n) update.name = n;
  }
  if (patch.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.color)) {
    update.color = patch.color;
  }
  if (Object.keys(update).length === 0) return;
  await supabase.from("haru_projects").update(update).eq("id", id);
  revalidatePath("/settings");
  revalidateAll();
}

/** Removes the project. Its todos stay — they just lose the project tag (FK is ON DELETE SET NULL). */
export async function deleteProject(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("haru_projects").delete().eq("id", id);
  revalidatePath("/settings");
  revalidateAll();
}
