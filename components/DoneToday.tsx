"use client";

import { useState } from "react";
import TodoRow from "@/components/TodoRow";
import type { Project, Todo } from "@/lib/types";

export default function DoneToday({
  done,
  projects,
}: {
  done: Todo[];
  projects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const byId = new Map(projects.map((p) => [p.id, p]));

  if (done.length === 0) return null;

  function toggle() {
    setOpen((o) => {
      if (!o) {
        setPop(true);
        setTimeout(() => setPop(false), 460);
      }
      return !o;
    });
  }

  return (
    <div className="earlier-block">
      <button className="earlier" aria-expanded={open} onClick={toggle}>
        <span>Done today</span>
        <span className="cnt">· {done.length}</span>
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>

      <div className={`earlier-wrap${open ? " open" : ""}${pop ? " pop" : ""}`}>
        <div className="earlier-inner">
          <div className="earlier-body">
            <ul className="list">
              {done.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  projects={projects}
                  showTools={false}
                  project={t.project_id ? byId.get(t.project_id) : undefined}
                />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
