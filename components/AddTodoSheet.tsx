"use client";

import Portal from "@/components/Portal";
import { useState, useTransition } from "react";
import { addTodo } from "@/app/(app)/actions";
import { todayISO } from "@/lib/recurrence";
import { REMINDER_OPTIONS, type Project } from "@/lib/types";

export default function AddTodoSheet({
  projects,
  initial,
  onClose,
}: {
  projects: Project[];
  initial: { title?: string; due?: string; dueTime?: string; projectId?: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [due, setDue] = useState(initial.due ?? "");
  const [dueTime, setDueTime] = useState(initial.dueTime ?? "");
  const [reminder, setReminder] = useState<number | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  const field: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--hair)",
    borderRadius: 10,
    padding: "9px 12px",
    background: "var(--surface)",
    fontSize: "0.9rem",
    marginTop: 6,
  };

  function save() {
    if (!title.trim() || pending) return;
    const effDue = due || (dueTime ? todayISO() : "");
    start(async () => {
      const fd = new FormData();
      fd.set("title", title.trim());
      fd.set("project_id", projectId);
      if (effDue) fd.set("due_date", effDue);
      if (effDue && dueTime) fd.set("due_time", dueTime);
      if (effDue && reminder != null) fd.set("reminder_min", String(reminder));
      if (flagged) fd.set("flagged", "on");
      if (notes.trim()) fd.set("notes", notes.trim());
      await addTodo(fd);
      onClose();
    });
  }

  return (
    <Portal>
      <div className="sheet-wrap" role="dialog" aria-modal="true">
        <div className="sheet-bd" onClick={onClose} />
        <div className="sheet">
          <h3>New task</h3>

          <label className="sec">Title</label>
          <input
            style={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

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
          <input type="date" style={field} value={due} onChange={(e) => setDue(e.target.value)} />

          <label className="sec">Time</label>
          <input
            type="time"
            style={field}
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />

          {(due || dueTime) && (
            <>
              <label className="sec">Remind me</label>
              <select
                style={field}
                value={reminder == null ? "" : String(reminder)}
                onChange={(e) =>
                  setReminder(e.target.value === "" ? null : Number(e.target.value))
                }
              >
                <option value="">No reminder</option>
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.min} value={o.min}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <label
            className="sec"
            style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}
          >
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
            />
            Flag as high priority
          </label>

          <label className="sec">Notes</label>
          <textarea
            style={{ ...field, minHeight: 64, resize: "vertical" }}
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
              {pending ? "Adding…" : "Add task"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
