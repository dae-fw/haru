"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { completeTodo, reopenTodo } from "@/app/(app)/actions";
import { burstFrom } from "@/lib/confetti";
import { describeRecurrence, todayISO } from "@/lib/recurrence";
import type { Project, Todo } from "@/lib/types";
import RescheduleSheet from "@/components/RescheduleSheet";

export default function TodoRow({
  todo,
  project,
  showTools = true,
}: {
  todo: Todo;
  project?: Project;
  showTools?: boolean;
}) {
  const [, start] = useTransition();
  const [sheet, setSheet] = useState(false);
  const checkRef = useRef<HTMLButtonElement>(null);

  // optimistic: flip the row's done-ness immediately, reconcile on revalidate
  const [optDone, setOptDone] = useOptimistic(todo.status === "done");
  const done = optDone;

  const today = todayISO();
  const overdue = !done && todo.due_date != null && todo.due_date < today;
  const dueToday = !done && todo.due_date === today;

  function toggle() {
    if (!done && checkRef.current) burstFrom(checkRef.current, 24);
    start(async () => {
      setOptDone(!done);
      await (done ? reopenTodo(todo.id) : completeTodo(todo.id));
    });
  }

  return (
    <li className={`row${done ? " done" : ""}`}>
      <button
        ref={checkRef}
        className="check"
        aria-label={done ? "Reopen task" : "Complete task"}
        onClick={toggle}
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
          {todo.streak > 0 && <span className="chip streak">{todo.streak}-in-a-row</span>}
          {todo.source === "google_tasks" && (
            <span className="chip">from Google Tasks</span>
          )}
          {project && (
            <span className="chip">
              <span className="dot" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {showTools && !done && (
            <button className="resched" onClick={() => setSheet(true)}>
              {todo.recurrence ? "reschedule / repeat" : "reschedule / park"}
            </button>
          )}
        </div>
      </div>

      {sheet && <RescheduleSheet todo={todo} onClose={() => setSheet(false)} />}
    </li>
  );
}
