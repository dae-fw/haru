"use client";

import { useTransition } from "react";
import {
  completeTodo,
  reopenTodo,
  rescheduleTodo,
  parkTodo,
  skipRecurrence,
} from "@/app/(app)/actions";
import { describeRecurrence, todayISO } from "@/lib/recurrence";
import type { Project, Todo } from "@/lib/types";

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function nextMondayISO(): string {
  const d = new Date();
  const delta = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function TodoRow({
  todo,
  project,
  showTools = true,
}: {
  todo: Todo;
  project?: Project;
  showTools?: boolean;
}) {
  const [pending, start] = useTransition();
  const done = todo.status === "done";
  const today = todayISO();
  const overdue = !done && todo.due_date != null && todo.due_date < today;
  const dueToday = !done && todo.due_date === today;

  return (
    <li className={`row${done ? " done" : ""}`} aria-busy={pending}>
      <button
        className="check"
        aria-label={done ? "Reopen task" : "Complete task"}
        onClick={() => start(() => (done ? reopenTodo(todo.id) : completeTodo(todo.id)))}
      />
      <div className="main">
        <div className="title">{todo.title}</div>
        <div className="meta">
          {overdue && <span className="chip overdue">overdue</span>}
          {dueToday && <span className="chip today">due today</span>}
          {todo.flagged && <span className="chip flag">★ flagged</span>}
          {todo.recurrence && (
            <span className="chip">↻ {describeRecurrence(todo.recurrence)}</span>
          )}
          {todo.streak > 0 && (
            <span className="chip streak">{todo.streak}-in-a-row</span>
          )}
          {todo.source === "google_tasks" && (
            <span className="chip">from Google Tasks</span>
          )}
          {project && (
            <span className="chip">
              <span className="dot" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
        </div>

        {showTools && !done && (
          <details className="rowtools">
            <summary>reschedule / park</summary>
            <div className="opts">
              <button onClick={() => start(() => rescheduleTodo(todo.id, today))}>
                Today
              </button>
              <button onClick={() => start(() => rescheduleTodo(todo.id, addDaysISO(1)))}>
                Tomorrow
              </button>
              <button onClick={() => start(() => rescheduleTodo(todo.id, nextMondayISO()))}>
                Next week
              </button>
              {todo.recurrence && (
                <button onClick={() => start(() => skipRecurrence(todo.id))}>
                  Skip this one
                </button>
              )}
              <form
                action={(fd) => {
                  const who = String(fd.get("who") ?? "").trim() || null;
                  start(() =>
                    parkTodo(todo.id, new Date(nextMondayISO()).toISOString(), who),
                  );
                }}
              >
                <input type="text" name="who" placeholder="waiting on… (name)" />
                <button type="submit">Park</button>
              </form>
            </div>
          </details>
        )}
      </div>
    </li>
  );
}
