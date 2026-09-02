import { timeInTz } from "@/lib/tz";
import type { CalEvent } from "@/lib/google";

export default function EventRow({
  event,
  past,
  tz,
}: {
  event: CalEvent;
  past?: boolean;
  tz: string;
}) {
  const when = event.allDay ? "all day" : timeInTz(event.start, tz);

  const inner = (
    <>
      <div className="title">{event.title}</div>
      <div className="meta">
        <span className="chip">{event.calendarName ?? "calendar"} ↗</span>
        {event.location && <span className="chip">📍 {event.location}</span>}
      </div>
    </>
  );

  return (
    <li className={`row event${past ? " past" : ""}`}>
      <span className="when">{when}</span>
      {event.htmlLink ? (
        <a
          className="main event-open"
          href={event.htmlLink}
          target="_blank"
          rel="noreferrer"
        >
          {inner}
        </a>
      ) : (
        <div className="main">{inner}</div>
      )}
    </li>
  );
}
