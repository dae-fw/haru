"use client";

import Portal from "@/components/Portal";
import { useState, useTransition } from "react";
import { createEvent } from "@/app/(app)/actions";
import { fromLocalInput, toLocalInput } from "@/lib/tz";

function defaultTimes(tz: string): { start: string; end: string } {
  const s = new Date();
  s.setMinutes(0, 0, 0);
  s.setHours(s.getHours() + 1);
  const e = new Date(s.getTime() + 60 * 60 * 1000);
  return { start: toLocalInput(s.toISOString(), tz), end: toLocalInput(e.toISOString(), tz) };
}

export default function AddEventSheet({ tz, onClose }: { tz: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [times] = useState(() => defaultTimes(tz));
  const [start, setStart] = useState(times.start);
  const [end, setEnd] = useState(times.end);
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
      const ok = await createEvent({
        title: title.trim(),
        start: fromLocalInput(start, tz),
        end: fromLocalInput(end, tz),
        location: location.trim() || undefined,
      });
      if (ok) onClose();
      else setError(true);
    });
  }

  return (
    <Portal>
    <div className="sheet-wrap" role="dialog" aria-modal="true">
      <div className="sheet-bd" onClick={onClose} />
      <div className="sheet">
        <h3>Add event</h3>
        <div style={{ fontSize: "0.76rem", color: "var(--ink-soft)", marginBottom: 4 }}>
          Goes straight onto your Google Calendar.
        </div>

        <label className="sec">Title</label>
        <input
          style={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's it called?"
          autoFocus
        />

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

        <label className="sec">Location</label>
        <input
          style={field}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional — an address or a name"
        />

        {error && (
          <div style={{ color: "var(--crit)", fontSize: "0.8rem", marginTop: 10 }}>
            Couldn&apos;t create that — try again.
          </div>
        )}

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
            {pending ? "Adding…" : "Add event"}
          </button>
        </div>
      </div>
    </div>
  </Portal>
  );
}
