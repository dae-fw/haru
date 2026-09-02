"use client";

import { useState } from "react";
import EventRow from "@/components/EventRow";
import TodoRow from "@/components/TodoRow";
import type { CalEvent } from "@/lib/google";
import type { Project, Todo } from "@/lib/types";

export default function EarlierToday({
  events,
  done,
  projects,
  tz,
}: {
  events: CalEvent[];
  done: Todo[];
  projects: Project[];
  tz: string;
}) {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const byId = new Map(projects.map((p) => [p.id, p]));

  if (events.length === 0 && done.length === 0) return null;

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
  if (events.length) parts.push(`${events.length} event${events.length > 1 ? "s" : ""}`);
  if (done.length) parts.push(`${done.length} done`);

  return (
    <div className="earlier-block">
      <button className="earlier" aria-expanded={open} onClick={toggle}>
        <span>Earlier today</span>
        <span className="cnt">· {parts.join(", ")}</span>
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>

      <div className={`earlier-wrap${open ? " open" : ""}${pop ? " pop" : ""}`}>
        <div className="earlier-inner">
          <div className="earlier-body">
            {events.length > 0 && (
              <>
                <div className="sub-h">Events</div>
                <ul className="list">
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} past tz={tz} />
                  ))}
                </ul>
              </>
            )}
            {done.length > 0 && (
              <>
                <div className="sub-h">Done</div>
                <ul className="list">
                  {done.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      showTools={false}
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
