"use client";

import Portal from "@/components/Portal";
import { useRef, useState } from "react";
import {
  parkTodo,
  rescheduleTodo,
  setRecurrence,
  snoozeTodo,
} from "@/app/(app)/actions";
import type { Recurrence, RecurrenceType, Todo } from "@/lib/types";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function plusDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return iso(d);
}
function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay()) % 7) || 7));
  return iso(d);
}
function plusHours(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}
function thisEvening() {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RescheduleSheet({
  todo,
  onClose,
}: {
  todo: Todo;
  onClose: () => void;
}) {
  const firedRef = useRef(false);
  const pending = false;
  const rec = todo.recurrence;
  const [rtype, setRtype] = useState<RecurrenceType>(rec?.type ?? "weekly");
  const [weekdays, setWeekdays] = useState<number[]>(rec?.weekdays ?? [1]);
  const [dom, setDom] = useState<number>(rec?.dayOfMonth ?? 1);
  const [everyN, setEveryN] = useState<number>(rec?.n ?? 3);
  const [who, setWho] = useState("");

  // Close the sheet immediately; let the server action + revalidate land behind it.
  const run = (fn: () => Promise<void>) => {
    if (firedRef.current) return;
    firedRef.current = true;
    void fn();
    onClose();
  };

  const saveRepeat = () => {
    let r: Recurrence;
    if (rtype === "weekly") r = { type: "weekly", weekdays: weekdays.slice().sort() };
    else if (rtype === "monthly") r = { type: "monthly", dayOfMonth: dom };
    else r = { type: "everyN", n: Math.max(1, everyN) };
    run(() => setRecurrence(todo.id, r));
  };

  const summary =
    rtype === "weekly"
      ? weekdays.length
        ? `Every week on ${weekdays.slice().sort().map((i) => DAYS[i]).join(", ")}`
        : "Pick at least one day"
      : rtype === "monthly"
        ? `Every month on the ${dom}`
        : `Every ${everyN} day${everyN === 1 ? "" : "s"}`;

  return (
    <Portal>
    <div className="sheet-wrap" role="dialog" aria-modal="true">
      <div className="sheet-bd" onClick={onClose} />
      <div className="sheet">
        <h3>Reschedule or park</h3>
        <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{todo.title}</div>

        <div className="sec">Later today</div>
        <div className="quick">
          <button disabled={pending} onClick={() => run(() => snoozeTodo(todo.id, plusHours(1)))}>+1 hour</button>
          <button disabled={pending} onClick={() => run(() => snoozeTodo(todo.id, plusHours(3)))}>+3 hours</button>
          <button disabled={pending} onClick={() => run(() => snoozeTodo(todo.id, thisEvening()))}>This evening</button>
        </div>

        <div className="sec">Another day</div>
        <button className="opt" disabled={pending} onClick={() => run(() => rescheduleTodo(todo.id, plusDays(0)))}>Today</button>
        <button className="opt" disabled={pending} onClick={() => run(() => rescheduleTodo(todo.id, plusDays(1)))}>Tomorrow</button>
        <button className="opt" disabled={pending} onClick={() => run(() => rescheduleTodo(todo.id, nextSaturday()))}>This weekend</button>
        <button className="opt" disabled={pending} onClick={() => run(() => rescheduleTodo(todo.id, nextMonday()))}>Next week</button>
        <label className="opt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Pick a date
          <input
            type="date"
            onChange={(e) => e.target.value && run(() => rescheduleTodo(todo.id, e.target.value))}
            style={{ border: "1px solid var(--hair)", borderRadius: 8, padding: "4px 8px", background: "var(--surface)" }}
          />
        </label>

        <div className="sec">Waiting on someone</div>
        <div style={{ fontSize: "0.76rem", color: "var(--ink-soft)", marginTop: 6 }}>
          Parks it off Today until next Monday, then it returns at the top.
        </div>
        <input
          className="who"
          placeholder="waiting on… (name, optional)"
          value={who}
          onChange={(e) => setWho(e.target.value)}
        />
        <button
          className="opt"
          style={{ color: "var(--accent)", borderBottom: "none" }}
          disabled={pending}
          onClick={() =>
            run(() =>
              parkTodo(todo.id, new Date(nextMonday()).toISOString(), who.trim() || null),
            )
          }
        >
          Park it →
        </button>

        <div className="sec">Repeat</div>
        <div className="seg" style={{ marginTop: 8 }}>
          {(["weekly", "monthly", "everyN"] as RecurrenceType[]).map((t) => (
            <button key={t} className={rtype === t ? "on" : ""} onClick={() => setRtype(t)}>
              {t === "everyN" ? "Every N days" : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {rtype === "weekly" && (
          <div className="wk">
            {DAYS.map((d, i) => (
              <button
                key={i}
                className={weekdays.includes(i) ? "on" : ""}
                onClick={() =>
                  setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))
                }
              >
                {d[0]}
              </button>
            ))}
          </div>
        )}
        {rtype === "monthly" && (
          <div style={{ marginTop: 10, fontSize: "0.85rem" }}>
            Day of month:{" "}
            <input
              type="number"
              min={1}
              max={31}
              value={dom}
              onChange={(e) => setDom(Number(e.target.value))}
              style={{ width: 64, border: "1px solid var(--hair)", borderRadius: 8, padding: "4px 8px", background: "var(--surface)" }}
            />
          </div>
        )}
        {rtype === "everyN" && (
          <div style={{ marginTop: 10, fontSize: "0.85rem" }}>
            Every{" "}
            <input
              type="number"
              min={1}
              value={everyN}
              onChange={(e) => setEveryN(Number(e.target.value))}
              style={{ width: 64, border: "1px solid var(--hair)", borderRadius: 8, padding: "4px 8px", background: "var(--surface)" }}
            />{" "}
            days
          </div>
        )}
        <div className="wk-sum">{summary}</div>

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>Close</button>
          {todo.recurrence && (
            <button className="btn" disabled={pending} onClick={() => run(() => setRecurrence(todo.id, null))}>
              Turn off repeat
            </button>
          )}
          <button className="btn primary" disabled={pending} onClick={saveRepeat}>
            Save repeat
          </button>
        </div>
      </div>
    </div>
  </Portal>
  );
}
