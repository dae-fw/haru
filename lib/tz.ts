// Pure timezone helpers — safe to import from client components.
// Server-only cookie access lives in lib/tz.server.ts.

/** yyyy-mm-dd for "now" in the given timezone. */
export function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** Hour 0–23 for "now" in the given timezone. */
export function hourInTz(tz: string): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(s, 10) % 24;
}

/** Local clock time for an instant, in the given timezone (e.g. "9:16 AM"). */
export function timeInTz(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** UTC offset string ("+08:00") for a timezone at a given instant. */
export function tzOffset(tz: string, at: Date): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = name?.match(/GMT([+-]\d{2}):?(\d{2})?/);
    if (m) return `${m[1]}:${m[2] ?? "00"}`;
  } catch {
    /* fall through */
  }
  return "+00:00";
}

/** ISO instant -> "YYYY-MM-DDTHH:mm" in tz, for an <input type="datetime-local">. */
export function toLocalInput(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DDTHH:mm" wall time in tz -> ISO instant with offset. */
export function fromLocalInput(local: string, tz: string): string {
  const off = tzOffset(tz, new Date());
  return `${local}:00${off}`;
}
