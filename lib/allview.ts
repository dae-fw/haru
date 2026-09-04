import type { Todo } from "@/lib/types";

export function plusDaysISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export const FILTER_KEYS = [
  "all",
  "overdue",
  "today",
  "week",
  "later",
  "nodate",
  "flagged",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export const PREDS: Record<FilterKey, (t: Todo, today: string, wk: string) => boolean> = {
  all: () => true,
  overdue: (t, today) => !!t.due_date && t.due_date < today,
  today: (t, today) => t.due_date === today,
  week: (t, today, wk) => !!t.due_date && t.due_date > today && t.due_date <= wk,
  later: (t, today, wk) => !!t.due_date && t.due_date > wk,
  nodate: (t) => !t.due_date,
  flagged: (t) => t.flagged,
};

const byDate = (a: Todo, b: Todo) =>
  (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99") ||
  (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99");

/** Group a task list into date buckets. "No date" is always last. */
export function dateBuckets(
  todos: Todo[],
  today: string,
): { key: string; title: string; items: Todo[] }[] {
  const tomorrow = plusDaysFrom(today, 1);
  const weekEnd = plusDaysFrom(today, 7);
  const b = {
    overdue: [] as Todo[],
    today: [] as Todo[],
    tomorrow: [] as Todo[],
    week: [] as Todo[],
    later: [] as Todo[],
    nodate: [] as Todo[],
  };
  for (const t of todos) {
    if (!t.due_date) b.nodate.push(t);
    else if (t.due_date < today) b.overdue.push(t);
    else if (t.due_date === today) b.today.push(t);
    else if (t.due_date === tomorrow) b.tomorrow.push(t);
    else if (t.due_date <= weekEnd) b.week.push(t);
    else b.later.push(t);
  }
  return [
    { key: "overdue", title: "Overdue", items: b.overdue.sort(byDate) },
    { key: "today", title: "Today", items: b.today.sort(byDate) },
    { key: "tomorrow", title: "Tomorrow", items: b.tomorrow.sort(byDate) },
    { key: "week", title: "This week", items: b.week.sort(byDate) },
    { key: "later", title: "Later", items: b.later.sort(byDate) },
    { key: "nodate", title: "No date", items: b.nodate },
  ].filter((g) => g.items.length > 0);
}

export function flatSorted(todos: Todo[]): Todo[] {
  return [...todos].sort(byDate);
}

function plusDaysFrom(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
