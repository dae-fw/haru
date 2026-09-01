"use client";

import { useState, useTransition } from "react";
import { updateEvent } from "@/app/(app)/actions";
import { fromLocalInput, toLocalInput } from "@/lib/tz";
import type { CalEvent } from "@/lib/google";

export default function EditEventSheet({
  event,
  tz,
  onClose,
}: {
  event: CalEvent;
  tz: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [location, setLocation] = useState(event.location ?? "");
  const [start, setStart] = useState(() => toLocalInput(event.start, tz));
  const [end, setEnd] = useState(() => toLocalInput(event.end, tz));
  const [pending, start_] = useTransition();
  const [error, setError] = useState(false);

  const field: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--hair)",
    borderRadius: 10,
    padding: "9px 12px",
    background: "var(--surface)",
    fontSize: "0.9rem",
    marginTop: 6,
  };

  function save() {
    if (!title.trim() || pending) return;
    start_(async () => {
      const ok = await updateEvent(event.id, {
        title,
        location: location.trim(),
        ...(event.allDay
          ? {}
          : { start: fromLocalInput(start, tz), end: fromLocalInput(end, tz) }),
      });
      if (ok) onClose();
      else setError(true);
    });
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true">
      <div className="sheet-bd" onClick={onClose} />
      <div className="sheet">
        <h3>Edit event</h3>
        <div style={{ fontSize: "0.76rem", color: "var(--ink-soft)", marginBottom: 4 }}>
          On your Google Calendar — changes sync there too.
        </div>

        <label className="sec">Title</label>
        <input style={field} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        {!event.allDay && (
          <>
            <label className="sec">Starts</label>
            <input
              type="datetime-local"
              style={field}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <label className="sec">Ends</label>
            <input
              type="datetime-local"
              style={field}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </>
        )}

        <label className="sec">Location</label>
        <input
          style={field}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional — an address or a name"
        />

        {error && (
          <div style={{ color: "var(--crit)", fontSize: "0.8rem", marginTop: 10 }}>
            Couldn&apos;t save that — try again.
          </div>
        )}

        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            style={{ display: "block", marginTop: 14, fontSize: "0.8rem", color: "var(--accent)" }}
          >
            Open in Google Calendar ↗
          </a>
        )}

        <div style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginTop: 8 }}>
          No delete here by design — remove events directly in Google Calendar.
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={pending || !title.trim()}
            onClick={save}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
