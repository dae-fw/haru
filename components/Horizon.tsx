"use client";

import { useState } from "react";
import TodoRow from "@/components/TodoRow";
import type { Project, Todo } from "@/lib/types";

export default function Horizon({
  week,
  month,
  projects,
}: {
  week: Todo[];
  month: Todo[];
  projects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const byId = new Map(projects.map((p) => [p.id, p]));

  if (week.length === 0 && month.length === 0) return null;

  function toggle() {
    setOpen((o) => {
      if (!o) {
        setPop(true);
        setTimeout(() => setPop(false), 460);
      }
      return !o;
    });
  }

  const parts: string[] = [];
  if (week.length) parts.push(`${week.length} this week`);
  if (month.length) parts.push(`${month.length} later this month`);

  return (
    <div className="earlier-block">
      <button className="earlier" aria-expanded={open} onClick={toggle}>
        <span>Coming up</span>
        <span className="cnt">· {parts.join(", ")}</span>
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>

      <div className={`earlier-wrap${open ? " open" : ""}${pop ? " pop" : ""}`}>
        <div className="earlier-inner">
          <div className="earlier-body">
            {week.length > 0 && (
              <>
                <div className="sub-h">This week</div>
                <ul className="list">
                  {week.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      projects={projects}
                      project={t.project_id ? byId.get(t.project_id) : undefined}
                    />
                  ))}
                </ul>
              </>
            )}
            {month.length > 0 && (
              <>
                <div className="sub-h">Later this month</div>
                <ul className="list">
                  {month.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      projects={projects}
                      project={t.project_id ? byId.get(t.project_id) : undefined}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
