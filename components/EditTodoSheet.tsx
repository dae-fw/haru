"use client";

import Portal from "@/components/Portal";
import { useState, useTransition } from "react";
import { updateTodo } from "@/app/(app)/actions";
import type { Project, Todo } from "@/lib/types";

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
  const [flagged, setFlagged] = useState(todo.flagged);
  const [notes, setNotes] = useState(todo.notes ?? "");
  const [pending, start] = useTransition();

  function save() {
    if (!title.trim() || pending) return;
    start(async () => {
      await updateTodo(todo.id, {
        title,
        project_id: projectId || null,
        due_date: due || null,
        flagged,
        notes,
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
            <button type="button" className="btn" onClick={() => setDue("")}>
              Clear
            </button>
          )}
        </div>

        <label className="sec" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <input
            type="checkbox"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
          />
          Flag as high priority
        </label>

        <label className="sec">Notes</label>
        <textarea
          style={{ ...field, minHeight: 72, resize: "vertical" }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />

        <div className="sheet-actions">
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
  </Portal>
  );
}
