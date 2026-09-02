"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { completeTodo, reopenTodo } from "@/app/(app)/actions";
import { burstFrom } from "@/lib/confetti";
import { enqueue, offlineCompletedIds, onQueueChange } from "@/lib/offlineQueue";
import { describeRecurrence, todayISO } from "@/lib/recurrence";
import type { Project, Todo } from "@/lib/types";
import RescheduleSheet from "@/components/RescheduleSheet";
import EditTodoSheet from "@/components/EditTodoSheet";

export default function TodoRow({
  todo,
  project,
  projects = [],
  showTools = true,
}: {
  todo: Todo;
  project?: Project;
  projects?: Project[];
  showTools?: boolean;
}) {
  const [, start] = useTransition();
  const [sheet, setSheet] = useState(false);
  const [edit, setEdit] = useState(false);
  const [playing, setPlaying] = useState(false);
  const checkRef = useRef<HTMLButtonElement>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [optDone, setOptDone] = useOptimistic(todo.status === "done");
  // completed while offline, waiting to sync
  const [queuedDone, setQueuedDone] = useState(false);
  useEffect(() => {
    const sync = () => setQueuedDone(offlineCompletedIds().has(todo.id));
    sync();
    return onQueueChange(sync);
  }, [todo.id]);
  const done = optDone || queuedDone;

  const today = todayISO();
  const overdue = !done && todo.due_date != null && todo.due_date < today;
  const dueToday = !done && todo.due_date === today;

  function toggle() {
    const goingDone = !done;
    if (goingDone) {
      if (checkRef.current) burstFrom(checkRef.current, 22);
      setPlaying(true);
      if (playTimer.current) clearTimeout(playTimer.current);
      playTimer.current = setTimeout(() => setPlaying(false), 650);
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (goingDone) {
        enqueue({ type: "complete", todoId: todo.id });
        setQueuedDone(true);
      }
      return; // no reopen offline
    }

    start(async () => {
      setOptDone(goingDone);
      await (goingDone ? completeTodo(todo.id) : reopenTodo(todo.id));
    });
  }

  return (
    <li className={`row${done ? " done" : ""}${playing ? " playing" : ""}`}>
      <button
        ref={checkRef}
        className="check"
        aria-label={done ? "Reopen task" : "Complete task"}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12l6 6L20 6" />
        </svg>
      </button>
      <div className="main">
        {showTools && !done ? (
          <button className="title title-edit" onClick={() => setEdit(true)}>
            {todo.title}
          </button>
        ) : (
          <div className="title">{todo.title}</div>
        )}
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
            <>
              <button className="resched" onClick={() => setEdit(true)}>
                edit
              </button>
              <button className="resched" onClick={() => setSheet(true)}>
                {todo.recurrence ? "reschedule / repeat" : "reschedule / park"}
              </button>
            </>
          )}
        </div>
      </div>

      {sheet && <RescheduleSheet todo={todo} onClose={() => setSheet(false)} />}
      {edit && (
        <EditTodoSheet
          todo={todo}
          projects={projects}
          onClose={() => setEdit(false)}
        />
      )}
    </li>
  );
}
