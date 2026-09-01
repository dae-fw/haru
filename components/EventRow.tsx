"use client";

import { useState } from "react";
import { timeInTz } from "@/lib/tz";
import type { CalEvent } from "@/lib/google";
import EditEventSheet from "@/components/EditEventSheet";

export default function EventRow({
  event,
  past,
  tz,
}: {
  event: CalEvent;
  past?: boolean;
  tz: string;
}) {
  const [edit, setEdit] = useState(false);
  const when = event.allDay ? "all day" : timeInTz(event.start, tz);

  return (
    <li className={`row event${past ? " past" : ""}`}>
      <span className="when">{when}</span>
      <button className="main event-edit" onClick={() => setEdit(true)}>
        <div className="title">{event.title}</div>
        <div className="meta">
          <span className="chip">calendar</span>
        </div>
      </button>
      {edit && <EditEventSheet event={event} tz={tz} onClose={() => setEdit(false)} />}
    </li>
  );
}
