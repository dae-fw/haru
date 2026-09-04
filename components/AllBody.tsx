"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { unparkTodo } from "@/app/(app)/actions";
import { todayISO } from "@/lib/recurrence";
import {
  PREDS,
  dateBuckets,
  flatSorted,
  plusDaysISO,
  type FilterKey,
} from "@/lib/allview";
import QuickAddTodo from "@/components/QuickAddTodo";
import TodoRow from "@/components/TodoRow";
import AllFilters from "@/components/AllFilters";
import DoneToday from "@/components/DoneToday";
import type { Project, Todo } from "@/lib/types";

export default function AllBody({
  active,
  waiting,
  doneToday,
  projects,
  counts,
}: {
  active: Todo[];
  waiting: Todo[];
  doneToday: Todo[];
  projects: Project[];
  counts: Record<string, number>;
}) {
  const sp = useSearchParams();
  const fParam = sp.get("f") ?? "all";
  const filter: FilterKey = (PREDS as Record<string, unknown>)[fParam]
    ? (fParam as FilterKey)
    : "all";

  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const byId = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );
  const today = todayISO();
  const wk = plusDaysISO(7);

  const matchQ = (t: Todo) => {
    if (!query) return true;
    const proj = t.project_id ? byId.get(t.project_id)?.name ?? "" : "";
    return (
      t.title.toLowerCase().includes(query) ||
      (t.notes ?? "").toLowerCase().includes(query) ||
      proj.toLowerCase().includes(query)
    );
  };

  const visible = active.filter((t) => PREDS[filter](t, today, wk) && matchQ(t));
  const searching = query.length > 0;

  const groups =
    filter === "all" && !searching
      ? dateBuckets(visible, today)
      : [{ key: "flat", title: "", items: flatSorted(visible) }];

  return (
    <div className="body">
      <QuickAddTodo projects={projects} dueToday={false} />

      <input
        className="all-search"
        type="search"
        placeholder="Search todos…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <AllFilters counts={counts} />

      {groups.length === 0 || groups.every((g) => g.items.length === 0) ? (
        <div className="empty">
          {searching
            ? "Nothing matches."
            : filter === "all"
              ? "No open todos. Add one above."
              : "Nothing in this filter."}
        </div>
      ) : groups[0].key === "flat" ? (
        <ul className="list">
          {groups[0].items.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              projects={projects}
              project={t.project_id ? byId.get(t.project_id) : undefined}
            />
          ))}
        </ul>
      ) : (
        groups.map((g) => (
          <div className="group" key={g.key}>
            <h2>
              {g.title} <span className="count">{g.items.length}</span>
            </h2>
            <ul className="list">
              {g.items.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  projects={projects}
                  project={t.project_id ? byId.get(t.project_id) : undefined}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      {filter === "all" && !searching && waiting.length > 0 && (
        <div className="waiting">
          <h2>Waiting on others · {waiting.length}</h2>
          {waiting.map((t) => (
            <div key={t.id}>
              <div className="w-title">{t.title}</div>
              <div className="w-meta">
                {t.waiting_on ? `Waiting on ${t.waiting_on}. ` : ""}
                {t.wake_at
                  ? `Back on ${new Date(t.wake_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}. `
                  : ""}
                <form action={unparkTodo.bind(null, t.id)} style={{ display: "inline" }}>
                  <button type="submit" className="linkish">
                    It&apos;s here now →
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {filter === "all" && !searching && (
        <DoneToday done={doneToday} projects={projects} />
      )}
    </div>
  );
}
