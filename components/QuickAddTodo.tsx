"use client";

import { useMemo, useState, useTransition } from "react";
import { addTodo } from "@/app/(app)/actions";
import { parseTodoInput } from "@/lib/nlp";
import type { Project } from "@/lib/types";

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function QuickAddTodo({
  projects = [],
  placeholder = "Add a task…",
  dueToday = true,
}: {
  projects?: Project[];
  placeholder?: string;
  /** default new tasks to today's date (Today screen) vs. no date (All list) */
  dueToday?: boolean;
}) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const parsed = useMemo(() => parseTodoInput(text, projects), [text, projects]);
  const showPreview = text.trim().length > 0 && parsed.hints.length > 0;

  function submit() {
    const t = text.trim();
    if (!t || pending) return;
    const fd = new FormData();
    fd.set("title", parsed.title || t);
    fd.set("project_id", parsed.projectId ?? "");
    const due = parsed.dueDate ?? (dueToday ? todayLocalISO() : "");
    if (due) fd.set("due_date", due);
    if (parsed.flagged) fd.set("flagged", "on");
    if (parsed.recurrence) fd.set("recurrence", JSON.stringify(parsed.recurrence));
    start(async () => {
      await addTodo(fd);
      setText("");
    });
  }

  return (
    <div>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="submit" aria-label="Add task" disabled={pending || !text.trim()}>
          +
        </button>
      </form>
      {showPreview && (
        <div className="nlp-preview">
          <span className="nlp-title">{parsed.title}</span>
          {parsed.hints.map((h) => (
            <span className="chip" key={h}>
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
