import type { Todo } from "@/lib/types";

export type OrganizeMode = "today" | "tomorrow" | "loose";

export interface OrganizeItem {
  id: string;
  todo: Todo;
  /** tomorrow mode: this card is an undated task being offered for tomorrow */
  pullIn?: boolean;
  /** loose mode: this task has no project — show project chips */
  needsProject?: boolean;
}

const isOpen = (t: Todo) => t.status === "open";

/** YYYY-MM-DD for `today` + n days (UTC-noon math, DST-safe enough for dates). */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "This week" button: today + 2 days; if that's Sat/Sun, push to the following Monday. */
export function thisWeekDate(today: string): string {
  let d = addDays(today, 2);
  const dow = new Date(d + "T12:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
  if (dow === 6) d = addDays(d, 2); // Sat -> Mon
  else if (dow === 0) d = addDays(d, 1); // Sun -> Mon
  return d;
}

/** Count for the Organize tab badge: undated + no-project open todos. Notes aren't touched. */
export function looseEndsCount(open: Todo[]): number {
  return open.filter(
    (t) => isOpen(t) && (t.due_date == null || t.project_id == null),
  ).length;
}

function byTime(a: Todo, b: Todo) {
  return (
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99")
  );
}

/** Build the card queue for a mode. Notes/ideas are never included — they live in Capture. */
export function organizeQueue(
  mode: OrganizeMode,
  open: Todo[],
  today: string,
): OrganizeItem[] {
  const tomorrow = addDays(today, 1);
  const t = (todo: Todo, extra: Partial<OrganizeItem> = {}): OrganizeItem => ({
    id: todo.id,
    todo,
    ...extra,
  });

  if (mode === "today") {
    return open
      .filter((x) => isOpen(x) && x.due_date != null && x.due_date <= today)
      .sort((a, b) => {
        const ao = a.due_date! < today ? 0 : 1;
        const bo = b.due_date! < today ? 0 : 1;
        return ao - bo || byTime(a, b);
      })
      .map((x) => t(x));
  }

  if (mode === "tomorrow") {
    const due = open
      .filter((x) => isOpen(x) && x.due_date === tomorrow)
      .sort(byTime)
      .map((x) => t(x));
    const undated = open
      .filter((x) => isOpen(x) && x.due_date == null)
      .map((x) => t(x, { pullIn: true }));
    return [...due, ...undated];
  }

  // loose ends: undated ∪ no-project open todos
  const seen = new Set<string>();
  const stuck: OrganizeItem[] = [];
  for (const x of open) {
    if (!isOpen(x)) continue;
    if (x.due_date != null && x.project_id != null) continue;
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    stuck.push(t(x, { needsProject: x.project_id == null }));
  }
  stuck.sort((a, b) => {
    const an = a.todo.due_date == null ? 0 : 1;
    const bn = b.todo.due_date == null ? 0 : 1;
    return an - bn;
  });
  return stuck;
}
