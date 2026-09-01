import type { Recurrence } from "./types";

/** ISO yyyy-mm-dd in local time. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Given a recurrence rule and the date the current instance was due (or today),
 * return the next due date as yyyy-mm-dd. Always strictly after `from`.
 */
export function nextDueDate(rule: Recurrence, fromISO: string): string {
  const from = parseISO(fromISO);

  if (rule.type === "everyN") {
    const n = Math.max(1, rule.n ?? 1);
    const next = new Date(from);
    next.setDate(next.getDate() + n);
    return toISODate(next);
  }

  if (rule.type === "weekly") {
    const days = (rule.weekdays ?? []).slice().sort((a, b) => a - b);
    if (days.length === 0) {
      const next = new Date(from);
      next.setDate(next.getDate() + 7);
      return toISODate(next);
    }
    for (let add = 1; add <= 7; add++) {
      const cand = new Date(from);
      cand.setDate(cand.getDate() + add);
      if (days.includes(cand.getDay())) return toISODate(cand);
    }
  }

  if (rule.type === "monthly") {
    const dom = Math.min(31, Math.max(1, rule.dayOfMonth ?? from.getDate()));
    const cand = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    // clamp to last day of that month
    const lastDay = new Date(cand.getFullYear(), cand.getMonth() + 1, 0).getDate();
    cand.setDate(Math.min(dom, lastDay));
    return toISODate(cand);
  }

  const fallback = new Date(from);
  fallback.setDate(fallback.getDate() + 1);
  return toISODate(fallback);
}

export function describeRecurrence(rule: Recurrence): string {
  if (rule.type === "everyN") return `every ${rule.n ?? 1} day${(rule.n ?? 1) === 1 ? "" : "s"}`;
  if (rule.type === "monthly") return `every ${ordinal(rule.dayOfMonth ?? 1)}`;
  if (rule.type === "weekly") {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const picked = (rule.weekdays ?? []).slice().sort((a, b) => a - b).map((i) => names[i]);
    return picked.length ? `weekly · ${picked.join(", ")}` : "weekly";
  }
  return "repeats";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
