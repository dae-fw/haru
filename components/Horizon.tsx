"use client";

import { useState } from "react";
import EventRow from "@/components/EventRow";
import TodoRow from "@/components/TodoRow";
import type { CalEvent } from "@/lib/google";
import type { Project, Todo } from "@/lib/types";

export default function Horizon({
  tomorrow,
  tomorrowEvents = [],
  week,
  month,
  projects,
  tz,
}: {
  tomorrow: Todo[];
  tomorrowEvents?: CalEvent[];
  week: Todo[];
  month: Todo[];
  projects: Project[];
  tz: string;
}) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const byId = new Map(projects.map((p) => [p.id, p]));

  const tmrCount = tomorrow.length + tomorrowEvents.length;
  if (tmrCount === 0 && week.length === 0 && month.length === 0) return null;

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
  if (tmrCount) parts.push(`${tmrCount} tomorrow`);
  if (week.length) parts.push(`${week.length} this week`);
  if (month.length) parts.push(`${month.length} later this month`);

  const list = (label: string, todos: Todo[]) =>
    todos.length > 0 && (
      <>
        <div className="sub-h">{label}</div>
        <ul className="list">
          {todos.map((t) => (
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
            {tmrCount > 0 && (
              <>
                <div className="sub-h">Tomorrow</div>
                <ul className="list">
                  {tomorrowEvents.map((e) => (
                    <EventRow key={e.id} event={e} tz={tz} />
                  ))}
                  {tomorrow.map((t) => (
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
            {list("This week", week)}
            {list("Later this month", month)}
          </div>
        </div>
      </div>
    </div>
  );
}
