import { requireUser } from "@/lib/auth";
import { getDoneToday, getOpenTodos, getProjects, isWaiting } from "@/lib/data";
import { todayISO } from "@/lib/recurrence";
import { unparkTodo } from "@/app/(app)/actions";
import QuickAddTodo from "@/components/QuickAddTodo";
import TodoRow from "@/components/TodoRow";
import AllFilters from "@/components/AllFilters";
import DoneToday from "@/components/DoneToday";
import Gear from "@/components/Gear";
import type { Project, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

function plusDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const PREDS: Record<string, (t: Todo, today: string, wk: string) => boolean> = {
  all: () => true,
  overdue: (t, today) => !!t.due_date && t.due_date < today,
  today: (t, today) => t.due_date === today,
  week: (t, today, wk) => !!t.due_date && t.due_date > today && t.due_date <= wk,
  later: (t, today, wk) => !!t.due_date && t.due_date > wk,
  nodate: (t) => !t.due_date,
  flagged: (t) => t.flagged,
};

export default async function AllPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  await requireUser();
  const [{ f }, projects, open, doneToday] = await Promise.all([
    searchParams,
    getProjects(),
    getOpenTodos(),
    getDoneToday(),
  ]);
  const filter = f && PREDS[f] ? f : "all";
  const today = todayISO();
  const wk = plusDaysISO(7);

  const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const active = open.filter((t) => !isWaiting(t));
  const waiting = open.filter(isWaiting);

  const counts: Record<string, number> = {};
  for (const key of Object.keys(PREDS)) {
    counts[key] = key === "all" ? 0 : active.filter((t) => PREDS[key](t, today, wk)).length;
  }

  const filtered = active
    .filter((t) => PREDS[filter](t, today, wk))
    .sort((a, b) => (a.due_date ?? "9999-99").localeCompare(b.due_date ?? "9999-99"));

  const buckets: { title: string; items: Todo[] }[] = [
    ...projects.map((p) => ({
      title: p.name,
      items: filtered.filter((t) => t.project_id === p.id),
    })),
    { title: "No project", items: filtered.filter((t) => !t.project_id) },
  ].filter((b) => b.items.length > 0);

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">All todos</div>
        <h1>The full list</h1>
        <div className="sub">
          {active.length} open{waiting.length ? ` · ${waiting.length} waiting` : ""}
        </div>
        <Gear />
      </header>

      <div className="body">
        <QuickAddTodo projects={projects} dueToday={false} />
        <AllFilters counts={counts} />

        {filter === "all" ? (
          buckets.map((b) => (
            <div className="group" key={b.title}>
              <h2>
                {b.title} <span className="count">{b.items.length} open</span>
              </h2>
              <ul className="list">
                {b.items.map((t) => (
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
        ) : (
          <ul className="list">
            {filtered.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                projects={projects}
                project={t.project_id ? byId.get(t.project_id) : undefined}
              />
            ))}
          </ul>
        )}

        {(filter === "all" ? buckets.length === 0 : filtered.length === 0) && (
          <div className="empty">
            {filter === "all" ? "No open todos. Add one above." : "Nothing in this filter."}
          </div>
        )}

        {filter === "all" && waiting.length > 0 && (
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

        {filter === "all" && (
          <DoneToday done={doneToday} projects={projects} />
        )}
      </div>
    </>
  );
}
