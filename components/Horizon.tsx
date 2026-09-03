"use client";

import { useState } from "react";
import TodoRow from "@/components/TodoRow";
import type { Project, Todo } from "@/lib/types";

export default function Horizon({
  tomorrow,
  week,
  month,
  projects,
}: {
  tomorrow: Todo[];
  week: Todo[];
  month: Todo[];
  projects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const byId = new Map(projects.map((p) => [p.id, p]));

  if (tomorrow.length === 0 && week.length === 0 && month.length === 0) return null;

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
  if (tomorrow.length) parts.push(`${tomorrow.length} tomorrow`);
  if (week.length) parts.push(`${week.length} this week`);
  if (month.length) parts.push(`${month.length} later this month`);

  const section = (label: string, list: Todo[]) =>
    list.length > 0 && (
      <>
        <div className="sub-h">{label}</div>
        <ul className="list">
          {list.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              projects={projects}
              project={t.project_id ? byId.get(t.project_id) : undefined}
            />
          ))}
        </ul>
      </>
    );

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
            {section("Tomorrow", tomorrow)}
            {section("This week", week)}
            {section("Later this month", month)}
          </div>
        </div>
      </div>
    </div>
  );
}
