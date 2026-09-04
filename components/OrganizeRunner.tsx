"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  completeTodo,
  deleteTodo,
  parkTodo,
  rescheduleTodo,
  updateTodo,
} from "@/app/(app)/actions";
import { burst } from "@/lib/confetti";
import { fmt12 } from "@/lib/nlp";
import type { OrganizeItem, OrganizeMode } from "@/lib/organize";
import type { Project } from "@/lib/types";

type Tally = Record<string, number>;

export default function OrganizeRunner({
  mode,
  items,
  projects,
  todayISO,
  tomorrowISO,
  thisWeekISO,
}: {
  mode: OrganizeMode;
  items: OrganizeItem[];
  projects: Project[];
  todayISO: string;
  tomorrowISO: string;
  thisWeekISO: string;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<Tally>({});
  const [pending, start] = useTransition();

  const item = items[i];
  const done = i >= items.length;

  function next(key: string) {
    setTally((t) => ({ ...t, [key]: (t[key] ?? 0) + 1 }));
    setI((n) => n + 1);
  }

  function run(key: string, fn: () => Promise<unknown>) {
    if (pending) return;
    start(async () => {
      await fn();
      next(key);
    });
  }

  if (done) {
    const line = Object.entries(tally)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(" · ");
    return (
      <div className="org-done">
        <div className="org-done-mark">✓</div>
        <div className="org-done-t">All sorted</div>
        {line && <div className="org-done-line">{line}</div>}
        <button
          className="btn primary"
          onClick={() => {
            router.refresh();
            router.push("/organize");
          }}
        >
          Done
        </button>
      </div>
    );
  }

  const todo = item.todo;
  const projName = todo.project_id
    ? projects.find((p) => p.id === todo.project_id)?.name ?? "—"
    : null;

  const stateLine =
    todo.due_date && todo.due_date < todayISO
      ? `overdue since ${todo.due_date}`
      : todo.due_date === todayISO
        ? `due today${todo.due_time ? ` · ${fmt12(todo.due_time)}` : ""}`
        : todo.due_date
          ? `due ${todo.due_date}${todo.due_time ? ` · ${fmt12(todo.due_time)}` : ""}`
          : "no due date";

  return (
    <div className="org-wrap">
      <div className="org-progress">
        <div className="org-bar">
          <span style={{ width: `${(i / items.length) * 100}%` }} />
        </div>
        <span className="org-count">
          {i + 1} of {items.length}
        </span>
      </div>

      <div className="org-card">
        <div className="org-state">{stateLine}</div>
        <div className="org-title">{todo.title}</div>
        {projName && (
          <div className="org-proj">
            <span className="dot" />
            {projName}
          </div>
        )}

        {item.pullIn ? (
          <>
            <div className="org-when-lbl">Do this tomorrow?</div>
            <div className="org-actions">
              <button className="btn primary" disabled={pending}
                onClick={() => run("→ tomorrow", () => rescheduleTodo(todo!.id, tomorrowISO))}>
                Yes, tomorrow
              </button>
              <button className="btn" disabled={pending} onClick={() => next("left")}>
                Skip
              </button>
              <button className="btn" disabled={pending}
                onClick={() => run("→ someday", () => updateTodo(todo!.id, { due_date: null }))}>
                Someday
              </button>
              <button className="btn danger" disabled={pending}
                onClick={() => run("deleted", () => deleteTodo(todo!.id))}>
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            {item.needsProject && (
              <div className="org-chips">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className="org-chip"
                    disabled={pending}
                    onClick={() =>
                      run("filed", () => updateTodo(todo!.id, { project_id: p.id }))
                    }
                  >
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="org-when-lbl">When</div>
            <div className="org-grid">
              {mode !== "today" && (
                <button className="btn" disabled={pending}
                  onClick={() => run("→ today", () => rescheduleTodo(todo!.id, todayISO))}>
                  Today
                </button>
              )}
              {mode === "today" && (
                <button className="btn" disabled={pending} onClick={() => next("kept")}>
                  Keep today
                </button>
              )}
              {mode !== "tomorrow" && (
                <button className="btn" disabled={pending}
                  onClick={() => run("→ tomorrow", () => rescheduleTodo(todo!.id, tomorrowISO))}>
                  Tomorrow
                </button>
              )}
              {mode === "tomorrow" && (
                <button className="btn" disabled={pending} onClick={() => next("kept")}>
                  Keep tomorrow
                </button>
              )}
              <button className="btn" disabled={pending}
                onClick={() => run("→ this week", () => rescheduleTodo(todo!.id, thisWeekISO))}>
                This week
              </button>
              <button className="btn" disabled={pending}
                onClick={() => run("→ someday", () => updateTodo(todo!.id, { due_date: null }))}>
                Someday
              </button>
            </div>
            <div className="org-actions">
              <button className="btn" disabled={pending}
                onClick={() =>
                  run("done", async () => {
                    burst(window.innerWidth / 2, window.innerHeight / 2, 24);
                    await completeTodo(todo!.id);
                  })
                }>
                Done
              </button>
              {mode !== "tomorrow" && (
                <button className="btn" disabled={pending}
                  onClick={() =>
                    run("parked", () =>
                      parkTodo(
                        todo!.id,
                        new Date(Date.now() + 3 * 864e5).toISOString(),
                        null,
                      ),
                    )
                  }>
                  Park 3 days
                </button>
              )}
              <button className="btn danger" disabled={pending}
                onClick={() => run("deleted", () => deleteTodo(todo!.id))}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
