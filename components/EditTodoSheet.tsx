"use client";

import Portal from "@/components/Portal";
import { useState, useTransition } from "react";
import { deleteTodo, demoteToIdea, updateTodo } from "@/app/(app)/actions";
import type { Project, Subtask, Todo } from "@/lib/types";

export default function EditTodoSheet({
  todo,
  projects,
  onClose,
}: {
  todo: Todo;
  projects: Project[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [projectId, setProjectId] = useState(todo.project_id ?? "");
  const [due, setDue] = useState(todo.due_date ?? "");
  const [dueTime, setDueTime] = useState(todo.due_time ?? "");
  const [flagged, setFlagged] = useState(todo.flagged);
  const [notes, setNotes] = useState(todo.notes ?? "");
  const [subs, setSubs] = useState<Subtask[]>(todo.subtasks ?? []);
  const [newSub, setNewSub] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  function addSub() {
    const t = newSub.trim();
    if (!t) return;
    setSubs((s) => [...s, { id: crypto.randomUUID(), title: t, done: false }]);
    setNewSub("");
  }

  function save() {
    if (!title.trim() || pending) return;
    start(async () => {
      await updateTodo(todo.id, {
        title,
        project_id: projectId || null,
        due_date: due || null,
        due_time: due ? dueTime || null : null,
        flagged,
        notes,
        subtasks: subs,
      });
      onClose();
    });
  }

  const field: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--hair)",
    borderRadius: 10,
    padding: "9px 12px",
    background: "var(--surface)",
    fontSize: "0.9rem",
    marginTop: 6,
  };

  return (
    <Portal>
    <div className="sheet-wrap" role="dialog" aria-modal="true">
      <div className="sheet-bd" onClick={onClose} />
      <div className="sheet">
        <h3>Edit task</h3>

        <label className="sec">Title</label>
        <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label className="sec">Project</label>
        <select style={field} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="sec">Due date</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <input
            type="date"
            style={{ ...field, marginTop: 0, flex: 1 }}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          {due && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDue("");
                setDueTime("");
              }}
            >
              Clear
            </button>
          )}
        </div>
        {due && (
          <>
            <label className="sec">Time (optional)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
              <input
                type="time"
                style={{ ...field, marginTop: 0, flex: 1 }}
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
              {dueTime && (
                <button type="button" className="btn" onClick={() => setDueTime("")}>
                  Clear
                </button>
              )}
            </div>
          </>
        )}

        <label className="sec" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <input
            type="checkbox"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
          />
          Flag as high priority
        </label>

        <label className="sec">
          Subtasks{subs.length ? ` · ${subs.filter((s) => s.done).length}/${subs.length}` : ""}
        </label>
        <div className="subtask-edit">
          {subs.map((s, i) => (
            <div className="subtask-row" key={s.id}>
              <button
                type="button"
                className={`subcheck${s.done ? " on" : ""}`}
                aria-label={s.done ? "Mark not done" : "Mark done"}
                onClick={() =>
                  setSubs((arr) => arr.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))
                }
              />
              <input
                value={s.title}
                onChange={(e) =>
                  setSubs((arr) =>
                    arr.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)),
                  )
                }
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "0.88rem" }}
              />
              <button
                type="button"
                className="linkish"
                aria-label="Remove subtask"
                onClick={() => setSubs((arr) => arr.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="subtask-row">
            <span className="subcheck ghost" aria-hidden />
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSub();
                }
              }}
              placeholder="Add a subtask"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "0.88rem" }}
            />
          </div>
        </div>

        <label className="sec">Notes</label>
        <textarea
          style={{ ...field, minHeight: 72, resize: "vertical" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />

        <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
          <button
            type="button"
            className="linkish"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await demoteToIdea(todo.id);
                onClose();
              })
            }
          >
            → Move to Ideas
          </button>
          {confirmDel ? (
            <button
              type="button"
              className="linkish"
              style={{ color: "var(--bad, #c0392b)" }}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteTodo(todo.id);
                  onClose();
                })
              }
            >
              Delete — sure?
            </button>
          ) : (
            <button
              type="button"
              className="linkish"
              onClick={() => setConfirmDel(true)}
            >
              Delete task
            </button>
          )}
        </div>

        <div className="sheet-actions">
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={pending || !title.trim()}
            onClick={save}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          </div>
        </div>
      </div>
    </div>
  </Portal>
  );
}
