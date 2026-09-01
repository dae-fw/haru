import { requireUser } from "@/lib/auth";
import { getDoneToday, getOpenTodos, getProjects, isOnToday, isWaiting } from "@/lib/data";
import { todayISO } from "@/lib/recurrence";
import { unparkTodo } from "@/app/(app)/actions";
import TodoRow from "@/components/TodoRow";
import type { Project, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage() {
  const { user } = await requireUser();
  const [projects, open, doneToday] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    getDoneToday(),
  ]);
  const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));

  const todayList = open.filter(isOnToday);
  const waitingList = open.filter(isWaiting);
  const overdue = todayList.filter((t) => t.due_date && t.due_date < todayISO());

  const name = user.user_metadata?.name?.split(" ")?.[0] ?? "there";

  const summary =
    todayList.length === 0
      ? "Nothing due today. Enjoy the room to breathe."
      : `${todayList.length} on your list${
          overdue.length ? `, ${overdue.length} overdue` : ""
        }. ${doneToday.length} done so far.`;

  const groups = groupByProject(todayList, projects);

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1>{greeting()}, {name}</h1>
        <div className="sub">
          {open.length} open · {waitingList.length} waiting · {doneToday.length} done
        </div>
        <a className="gear" href="/settings" aria-label="Settings">⚙</a>
      </header>

      <div className="body">
        <div className="summary">{summary}</div>

        {groups.map(({ project, items }) => (
          <div className="group" key={project?.id ?? "none"}>
            <h2>
              {project?.name ?? "No project"} <span className="count">{items.length}</span>
            </h2>
            <ul className="list">
              {items.map((t) => (
                <TodoRow key={t.id} todo={t} project={t.project_id ? byId.get(t.project_id) : undefined} />
              ))}
            </ul>
          </div>
        ))}

        {waitingList.length > 0 && (
          <div className="waiting">
            <h2>Waiting on others · {waitingList.length}</h2>
            {waitingList.map((t) => (
              <form key={t.id} action={unparkTodo.bind(null, t.id)}>
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
                  <button type="submit" style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", font: "inherit" }}>
                    It&apos;s here now →
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}

        {doneToday.length > 0 && (
          <div className="group">
            <h2>Done today <span className="count">{doneToday.length}</span></h2>
            <ul className="list">
              {doneToday.map((t) => (
                <TodoRow key={t.id} todo={t} showTools={false} project={t.project_id ? byId.get(t.project_id) : undefined} />
              ))}
            </ul>
          </div>
        )}

        {todayList.length === 0 && waitingList.length === 0 && (
          <div className="empty">All clear. Add something from the Capture or All tab.</div>
        )}
      </div>
    </>
  );
}

function groupByProject(todos: Todo[], projects: Project[]) {
  const order = [...projects.map((p) => p.id), null];
  const map = new Map<string | null, Todo[]>();
  for (const t of todos) {
    const key = t.project_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return order
    .filter((k) => map.has(k))
    .map((k) => ({
      project: k ? projects.find((p) => p.id === k) : undefined,
      items: map.get(k)!,
    }));
}
