"use client";

import { useState, useTransition } from "react";
import { deleteProject, updateProject } from "@/app/(app)/actions";
import type { Project } from "@/lib/types";

export default function ProjectRow({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim() || pending) return;
    start(async () => {
      await updateProject(project.id, { name, color });
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <li className="row">
        <span
          className="dot"
          style={{ background: project.color, width: 12, height: 12, marginTop: 4 }}
        />
        <div className="main">
          <div className="title">{project.name}</div>
        </div>
        <button className="resched" onClick={() => setEditing(true)}>
          edit
        </button>
      </li>
    );
  }

  return (
    <li className="row" style={{ alignItems: "center" }}>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        style={{ width: 34, height: 32, padding: 2, flex: "none" }}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          flex: 1,
          border: "1px solid var(--hair)",
          borderRadius: 8,
          padding: "6px 9px",
          background: "var(--surface)",
          fontSize: "0.85rem",
        }}
      />
      <button className="resched" disabled={pending || !name.trim()} onClick={save}>
        {pending ? "…" : "save"}
      </button>
      <button className="resched" onClick={() => setEditing(false)}>
        cancel
      </button>
      {confirmDel ? (
        <button
          className="resched"
          style={{ color: "var(--bad, #c0392b)" }}
          onClick={() => start(() => deleteProject(project.id))}
        >
          really?
        </button>
      ) : (
        <button className="resched" onClick={() => setConfirmDel(true)}>
          delete
        </button>
      )}
    </li>
  );
}
