"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
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
  const [, start] = useTransition();
  const [sheet, setSheet] = useState(false);
  const [edit, setEdit] = useState(false);
  const [openSubs, setOpenSubs] = useState(false);
  const [playing, setPlaying] = useState(false);
  const checkRef = useRef<HTMLButtonElement>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // horizontal swipe: right = complete, left = reschedule / park
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const COMMIT = 72;

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
  const laterLabel = !done && todo.due_date ? dueLabel(todo.due_date) : null;
  const subs = todo.subtasks ?? [];
  const subsDone = subs.filter((s) => s.done).length;

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

  const swipeEnabled = showTools && !done;

  function onPointerDown(e: React.PointerEvent) {
    if (!swipeEnabled || e.pointerType === "mouse") return;
    dragFrom.current = e.clientX;
    setSwiping(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragFrom.current == null) return;
    const raw = e.clientX - dragFrom.current;
    setDx(Math.max(-140, Math.min(140, raw)));
  }
  function endSwipe() {
    if (dragFrom.current == null) return;
    const settled = dx;
    dragFrom.current = null;
    setSwiping(false);
    setDx(0);
    if (settled >= COMMIT) {
      if (!done) toggle();
    } else if (settled <= -COMMIT) {
      setSheet(true);
    }
  }

  return (
    <li className={`row${done ? " done" : ""}${playing ? " playing" : ""}`}>
      {swipeEnabled && (
        <>
          <span className={`swipe-cue left${dx >= COMMIT ? " armed" : ""}`} aria-hidden>
            ✓
          </span>
          <span className={`swipe-cue right${dx <= -COMMIT ? " armed" : ""}`} aria-hidden>
            ↻
          </span>
        </>
      )}
      <div
        className="row-inner"
        style={
          swipeEnabled
            ? {
                transform: dx ? `translateX(${dx}px)` : undefined,
                transition: swiping ? "none" : "transform .2s ease",
              }
            : undefined
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
      >
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
