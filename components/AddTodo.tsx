"use client";

import { useRef, useTransition } from "react";
import { addTodo } from "@/app/(app)/actions";
import type { Project } from "@/lib/types";

export default function AddTodo({ projects }: { projects: Project[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="settings-block"
      action={(fd) => start(async () => {
        await addTodo(fd);
        formRef.current?.reset();
      })}
    >
      <div className="label">Add a todo</div>
      <input type="text" name="title" placeholder="What needs doing?" required style={{ flex: 1, minWidth: 160 }} />
      <select name="project_id" defaultValue="">
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input type="date" name="due_date" />
      <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
        <input type="checkbox" name="flagged" /> flag
      </label>
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
