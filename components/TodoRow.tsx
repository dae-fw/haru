"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { completeTodo, reopenTodo, toggleSubtask } from "@/app/(app)/actions";
import { burstFrom } from "@/lib/confetti";
import { enqueue, offlineCompletedIds, onQueueChange } from "@/lib/offlineQueue";
import { describeRecurrence, todayISO } from "@/lib/recurrence";
import { fmt12 } from "@/lib/nlp";
import type { Project, Todo } from "@/lib/types";
import RescheduleSheet from "@/components/RescheduleSheet";
import EditTodoSheet from "@/components/EditTodoSheet";

function dueLabel(dateISO: string): string | null {
  const today = todayISO();
  if (dateISO <= today) return null; // overdue / due-today chips cover these
  const d = new Date(dateISO + "T12:00:00");
  const diff = Math.round((d.getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
  if (diff === 1) return "tomorrow";
  if (diff <= 6) return d.toLocaleDateString(undefined, { weekday: "short" });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

export default function TodoRow({
  todo,
  project,
  projects = [],
  showTools = true,
  hint,
}: {
  todo: Todo;
  project?: Project;
  projects?: Project[];
  showTools?: boolean;
  hint?: string;
}) {
  const GRACE_MS = 5000;
  const [, start] = useTransition();
  const [sheet, setSheet] = useState(false);
  const [edit, setEdit] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const [playing, setPlaying] = useState(false);
  const checkRef = useRef<HTMLButtonElement>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localDone, setLocalDone] = useState(todo.status === "done");
  // completing, inside the 5s undo window — not yet sent to the server
  const [grace, setGrace] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // completed while offline, waiting to sync
  const [queuedDone, setQueuedDone] = useState(false);
  useEffect(() => {
    const sync = () => setQueuedDone(offlineCompletedIds().has(todo.id));
    sync();
    return onQueueChange(sync);
  }, [todo.id]);
  const done = localDone || queuedDone;

  const commit = useRef(() => {});
  commit.current = () => {
    graceTimer.current = null;
    setGrace(false);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue({ type: "complete", todoId: todo.id });
      setQueuedDone(true);
      return;
    }
    start(async () => {
      try {
        await completeTodo(todo.id);
      } catch {
        setLocalDone(false);
      }
    });
  };
  // fire the pending commit if the row unmounts (e.g. leaving the screen)
  useEffect(() => {
    return () => {
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
        commit.current();
      }
    };
  }, []);

  const today = todayISO();
  const overdue = !done && todo.due_date != null && todo.due_date < today;
  const dueToday = !done && todo.due_date === today;
  const laterLabel = !done && todo.due_date ? dueLabel(todo.due_date) : null;
  const subs = todo.subtasks ?? [];
  const subsDone = subs.filter((s) => s.done).length;

  function undo() {
    if (graceTimer.current) clearTimeout(graceTimer.current);
    graceTimer.current = null;
    setGrace(false);
    setLocalDone(false);
    setPlaying(false);
  }

  function toggle() {
    // in the undo window → tapping the check again cancels it
    if (grace) {
      undo();
      return;
    }
    const goingDone = !done;

    if (goingDone) {
      if (checkRef.current) burstFrom(checkRef.current, 22);
      setPlaying(true);
      if (playTimer.current) clearTimeout(playTimer.current);
      playTimer.current = setTimeout(() => setPlaying(false), 650);
      setLocalDone(true);
      setGrace(true);
      graceTimer.current = setTimeout(() => commit.current(), GRACE_MS);
      return;
    }

    // reopening (only happens for already-committed done rows)
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setLocalDone(false);
    start(() => reopenTodo(todo.id));
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
        {grace ? (
          <div className="undo-row">
            <button className="undo-link" onClick={undo}>
              Undo
            </button>
            <span className="undo-bar" aria-hidden />
          </div>
        ) : (
        <div className="meta">
          {overdue && <span className="chip overdue">overdue</span>}
          {dueToday && <span className="chip today">due today</span>}
          {!done && hint && !overdue && !dueToday && (
            <span className="chip">{hint}</span>
          )}
          {laterLabel && <span className="chip">{laterLabel}</span>}
          {!done && todo.due_time && <span className="chip">{fmt12(todo.due_time)}</span>}
          {todo.flagged && <span className="chip flag">★ flagged</span>}
          {todo.recurrence && (
            <span className="chip">↻ {describeRecurrence(todo.recurrence)}</span>
          )}
          {todo.streak > 0 && <span className="chip streak">{todo.streak}-in-a-row</span>}
          {todo.source === "google_tasks" && (
            <span className="chip">from Google Tasks</span>
          )}
          {subs.length > 0 && (
            <button
              className={`chip subs-chip${openSubs ? " on" : ""}`}
              onClick={() => setOpenSubs((o) => !o)}
            >
              ☑ {subsDone}/{subs.length}
            </button>
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
        )}

        {openSubs && subs.length > 0 && (
          <ul className="subs-list">
            {subs.map((s) => (
              <li key={s.id} className={s.done ? "done" : ""}>
                <button
                  className={`subcheck${s.done ? " on" : ""}`}
                  aria-label={s.done ? "Undo subtask" : "Complete subtask"}
                  onClick={() => start(() => toggleSubtask(todo.id, s.id))}
                />
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        )}
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
