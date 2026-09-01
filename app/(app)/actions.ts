"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { nextDueDate, toISODate } from "@/lib/recurrence";
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

  await supabase.from("haru_todos").insert({
    user_id: user.id,
    title,
    project_id: projectId,
    due_date: due,
    flagged,
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

export async function disconnectGoogle() {
  const { supabase } = await requireUser();
  await supabase.from("haru_google_tokens").delete().not("user_id", "is", null);
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function setNickname(formData: FormData) {
  const { supabase } = await requireUser();
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 40);
  await supabase.auth.updateUser({ data: { nickname: nickname || null } });
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
