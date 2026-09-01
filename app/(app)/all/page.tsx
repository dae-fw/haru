import { requireUser } from "@/lib/auth";
import { getDoneToday, getOpenTodos, getProjects, isWaiting } from "@/lib/data";
import AddTodo from "@/components/AddTodo";
import TodoRow from "@/components/TodoRow";
import Gear from "@/components/Gear";
import type { Project, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AllPage() {
  await requireUser();
  const [projects, open, doneToday] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    getDoneToday(),
  ]);
  const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const active = open.filter((t) => !isWaiting(t));

  const buckets: { title: string; color?: string; items: Todo[] }[] = [
    ...projects.map((p) => ({
      title: p.name,
      color: p.color,
      items: active.filter((t) => t.project_id === p.id),
    })),
    { title: "No project", items: active.filter((t) => !t.project_id) },
  ].filter((b) => b.items.length > 0);

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">All todos</div>
        <h1>The full list</h1>
        <div className="sub">{active.length} open across {buckets.length} groups</div>
        <Gear />
      </header>

      <div className="body">
        <AddTodo projects={projects} />

        {buckets.map((b) => (
          <div className="group" key={b.title}>
            <h2>
              {b.title} <span className="count">{b.items.length} open</span>
            </h2>
            <ul className="list">
              {b.items.map((t) => (
                <TodoRow key={t.id} todo={t} projects={projects} project={t.project_id ? byId.get(t.project_id) : undefined} />
              ))}
            </ul>
          </div>
        ))}

        {doneToday.length > 0 && (
          <div className="group">
            <h2>Done today <span className="count">{doneToday.length}</span></h2>
            <ul className="list">
              {doneToday.map((t) => (
                <TodoRow key={t.id} todo={t} projects={projects} showTools={false} project={t.project_id ? byId.get(t.project_id) : undefined} />
              ))}
            </ul>
          </div>
        )}

        {active.length === 0 && (
          <div className="empty">No open todos. Add one above.</div>
        )}
      </div>
    </>
  );
}
