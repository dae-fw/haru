import { describeRecurrence } from "@/lib/recurrence";
import type { Project, Recurrence } from "@/lib/types";

export interface ParsedTodo {
  title: string;
  dueDate?: string; // yyyy-mm-dd (local)
  dueTime?: string; // "HH:MM" 24h
  projectId?: string;
  flagged?: boolean;
  recurrence?: Recurrence;
  hints: string[]; // human-readable, for the live preview
}

const DAYS_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAYS_LONG = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
function addDays(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}
function nextWeekday(target: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const ahead = (target - d.getDay() + 7) % 7; // 0 = today
  d.setDate(d.getDate() + ahead);
  return d;
}
function nextMonthDay(day: number): Date {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const d = new Date(now.getFullYear(), now.getMonth(), day, 12);
  if (d.getTime() < now.getTime()) d.setMonth(d.getMonth() + 1);
  return d;
}
function labelFor(dateISO: string): string {
  const t = iso(addDays(0));
  const tm = iso(addDays(1));
  if (dateISO === t) return "today";
  if (dateISO === tm) return "tomorrow";
  const d = new Date(dateISO + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Lightweight, predictable natural-language parse for quick capture.
 * Explicit patterns only — no AI inference. Returns the cleaned title plus
 * whatever date / project / flag it could pull out.
 */
export function parseTodoInput(raw: string, projects: Project[]): ParsedTodo {
  let text = ` ${raw.trim()} `;
  const hints: string[] = [];
  const out: ParsedTodo = { title: raw.trim(), hints };

  // --- flag: ! or !! (standalone or trailing) ---
  if (/(^|\s)!!?(\s|$)/.test(text)) {
    out.flagged = true;
    hints.push("★ flagged");
    text = text.replace(/(^|\s)!!?(\s|$)/g, " ");
  }

  // --- project: #name / @name, or an exact project-name word ---
  const tagMatch = text.match(/(^|\s)[#@]([A-Za-z0-9][\w-]*)/);
  if (tagMatch) {
    const q = tagMatch[2].toLowerCase();
    const p = projects.find((x) => x.name.toLowerCase().startsWith(q));
    if (p) {
      out.projectId = p.id;
      hints.push(`#${p.name}`);
      text = text.replace(tagMatch[0], " ");
    }
  }
  if (!out.projectId) {
    for (const p of projects) {
      const re = new RegExp(`(^|\\s)${escapeRe(p.name)}(\\s|$)`, "i");
      if (re.test(text)) {
        out.projectId = p.id;
        hints.push(`#${p.name}`);
        text = text.replace(re, " ");
        break;
      }
    }
  }

  // --- recurrence (before date, so "every tuesday" isn't read as a one-off) ---
  const rec = extractRecurrence(text);
  if (rec) {
    out.recurrence = rec.rule;
    hints.push(`↻ ${describeRecurrence(rec.rule)}`);
    text = text.replace(rec.match, " ");
  }

  // --- time of day ---
  const time = extractTime(text);
  if (time) {
    out.dueTime = time.hhmm;
    text = text.replace(time.match, " ");
  }

  // --- date ---
  const date = extractDate(text);
  if (date) {
    out.dueDate = date.iso;
    hints.push(`due ${labelFor(date.iso)}${out.dueTime ? ` ${fmt12(out.dueTime)}` : ""}`);
    text = text.replace(date.match, " ");
  }

  // a time with no date means today
  if (out.dueTime && !out.dueDate) {
    out.dueDate = iso(addDays(0));
    hints.push(`due today ${fmt12(out.dueTime)}`);
  }

  // a recurring task with no explicit date starts at its first occurrence
  if (out.recurrence && !out.dueDate) {
    out.dueDate = firstOccurrence(out.recurrence);
    hints.push(`starts ${labelFor(out.dueDate)}`);
  }

  out.title = text.replace(/\s+/g, " ").trim() || raw.trim();
  return out;
}

function firstOccurrence(rule: Recurrence): string {
  if (rule.type === "everyN") return iso(addDays(0));
  if (rule.type === "monthly") return iso(nextMonthDay(rule.dayOfMonth ?? 1));
  const days = (rule.weekdays ?? []).slice().sort((a, b) => a - b);
  if (days.length === 0) return iso(addDays(0));
  const soonest = days
    .map((d) => nextWeekday(d))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  return iso(soonest);
}

const WD_RE = "sun|mon|tue|wed|thu|fri|sat";
function weekdayIndex(tok: string): number {
  const k = tok.slice(0, 3).toLowerCase();
  return DAYS_SHORT.indexOf(k);
}

function extractRecurrence(
  text: string,
): { rule: Recurrence; match: string } | null {
  const t = text.toLowerCase();

  let m = t.match(/(^|\s)(every ?day|daily)(\s|$)/);
  if (m) return { rule: { type: "everyN", n: 1 }, match: m[0] };

  m = t.match(/(^|\s)every other day(\s|$)/);
  if (m) return { rule: { type: "everyN", n: 2 }, match: m[0] };

  m = t.match(/(^|\s)every (\d{1,3}) days?(\s|$)/);
  if (m) return { rule: { type: "everyN", n: Math.max(1, Number(m[2])) }, match: m[0] };

  m = t.match(/(^|\s)every weekday(s)?(\s|$)/);
  if (m) return { rule: { type: "weekly", weekdays: [1, 2, 3, 4, 5] }, match: m[0] };

  m = t.match(/(^|\s)every weekend(s)?(\s|$)/);
  if (m) return { rule: { type: "weekly", weekdays: [0, 6] }, match: m[0] };

  // "every 15th" / "monthly on the 15th" / "monthly"
  m = t.match(/(^|\s)(monthly|every month)(\s+on(\s+the)?\s+(\d{1,2})(st|nd|rd|th)?)?(\s|$)/);
  if (m) {
    const dom = m[5] ? Number(m[5]) : new Date().getDate();
    return { rule: { type: "monthly", dayOfMonth: Math.min(31, Math.max(1, dom)) }, match: m[0] };
  }
  m = t.match(/(^|\s)every (\d{1,2})(st|nd|rd|th)(\s|$)/);
  if (m) {
    const dom = Number(m[2]);
    if (dom >= 1 && dom <= 31)
      return { rule: { type: "monthly", dayOfMonth: dom }, match: m[0] };
  }

  // "every tuesday and thursday", "repeat every tue, thu", "each mon & wed", "every tues + thurs"
  const list = t.match(
    new RegExp(
      `(^|\\s)(?:repeat\\s+)?(?:every|each)\\s+((?:${WD_RE})[a-z]*(?:\\s*(?:,|and|&|\\+|/|\\s)\\s*(?:${WD_RE})[a-z]*)*)(\\s|$)`,
    ),
  );
  if (list) {
    const toks = list[2].match(new RegExp(`(?:${WD_RE})[a-z]*`, "g")) ?? [];
    const idx = Array.from(new Set(toks.map(weekdayIndex).filter((i) => i >= 0))).sort(
      (a, b) => a - b,
    );
    if (idx.length) return { rule: { type: "weekly", weekdays: idx }, match: list[0] };
  }

  m = t.match(/(^|\s)(weekly|every week)(\s|$)/);
  if (m) return { rule: { type: "weekly", weekdays: [] }, match: m[0] };

  return null;
}

function extractDate(text: string): { iso: string; match: string } | null {
  const t = text.toLowerCase();

  const simple: [RegExp, (m: RegExpMatchArray) => Date][] = [
    [/(^|\s)(today|tonight)(\s|$)/, () => addDays(0)],
    [/(^|\s)(tomorrow|tmr|tmrw)(\s|$)/, () => addDays(1)],
    [/(^|\s)this weekend(\s|$)/, () => nextWeekday(6)],
    [/(^|\s)next week(\s|$)/, () => nextWeekday(1) /* upcoming Monday */],
    [/(^|\s)in (\d{1,3}) days?(\s|$)/, (m: RegExpMatchArray) => addDays(Number(m[2] ?? 1))],
    [/(^|\s)in a week(\s|$)/, () => addDays(7)],
  ];
  for (const [re, fn] of simple) {
    const m = t.match(re);
    if (m) return { iso: iso(fn(m)), match: m[0] };
  }

  // weekday names, optionally "next friday"
  const wd = t.match(
    /(^|\s)(next\s+)?(sun|mon|tue|wed|thu|fri|sat)(day|nesday|rsday|urday)?(\s|$)/,
  );
  if (wd) {
    const key = wd[3];
    let idx = DAYS_SHORT.indexOf(key);
    if (idx < 0) idx = DAYS_LONG.findIndex((d) => d.startsWith(key));
    if (idx >= 0) {
      const d = nextWeekday(idx);
      if (wd[2] && iso(d) === iso(addDays(0))) d.setDate(d.getDate() + 7); // "next" + today -> +7
      return { iso: iso(d), match: wd[0] };
    }
  }

  // "sep 5" / "5 sep" / "september 5"
  const md = t.match(
    /(^|\s)(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(st|nd|rd|th)?(\s|$)/,
  );
  const dm = t.match(
    /(^|\s)(\d{1,2})(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(\s|$)/,
  );
  const monthDay = md
    ? { mon: MONTHS.indexOf(md[2]), day: Number(md[3]), match: md[0] }
    : dm
      ? { mon: MONTHS.indexOf(dm[4]), day: Number(dm[2]), match: dm[0] }
      : null;
  if (monthDay && monthDay.mon >= 0 && monthDay.day >= 1 && monthDay.day <= 31) {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    let y = now.getFullYear();
    let d = new Date(y, monthDay.mon, monthDay.day, 12);
    if (d.getTime() < now.getTime() - 86400000) d = new Date(++y, monthDay.mon, monthDay.day, 12);
    return { iso: iso(d), match: monthDay.match };
  }

  // "the 15th" / "on the 15th" -> day of this or next month
  const nth = t.match(/(^|\s)(on\s+)?(the\s+)?(\d{1,2})(st|nd|rd|th)(\s|$)/);
  if (nth) {
    const day = Number(nth[4]);
    if (day >= 1 && day <= 31) return { iso: iso(nextMonthDay(day)), match: nth[0] };
  }

  // ISO / MM-DD / M/D
  const slash = t.match(/(^|\s)(\d{4}-\d{2}-\d{2})(\s|$)/);
  if (slash) return { iso: slash[2], match: slash[0] };
  const mdSlash = t.match(/(^|\s)(\d{1,2})\/(\d{1,2})(\s|$)/);
  if (mdSlash) {
    const now = new Date();
    let y = now.getFullYear();
    const mon = Number(mdSlash[2]) - 1;
    const day = Number(mdSlash[3]);
    if (mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
      let d = new Date(y, mon, day, 12);
      if (d.getTime() < now.getTime() - 86400000) d = new Date(++y, mon, day, 12);
      return { iso: iso(d), match: mdSlash[0] };
    }
  }

  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

/** "at 3pm", "3:30pm", "9 am", "15:00", "noon", "midnight". */
function extractTime(text: string): { hhmm: string; match: string } | null {
  const t = text.toLowerCase();

  let m = t.match(/(^|\s)(?:at\s+)?noon(\s|$)/);
  if (m) return { hhmm: "12:00", match: m[0] };
  m = t.match(/(^|\s)(?:at\s+)?midnight(\s|$)/);
  if (m) return { hhmm: "00:00", match: m[0] };

  // 3pm / 3:30 pm / 3.30pm
  m = t.match(/(^|\s)(?:at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)(\s|$)/);
  if (m) {
    let h = Number(m[2]) % 12;
    if (m[4] === "pm") h += 12;
    const min = m[3] ? Number(m[3]) : 0;
    if (h <= 23 && min <= 59) {
      return { hhmm: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, match: m[0] };
    }
  }

  // 24h: "at 15:00" / "@ 9:30" (require the "at"/"@" so we don't eat dates)
  m = t.match(/(^|\s)(?:at\s+|@\s*)(\d{1,2}):(\d{2})(\s|$)/);
  if (m) {
    const h = Number(m[2]);
    const min = Number(m[3]);
    if (h <= 23 && min <= 59) {
      return { hhmm: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`, match: m[0] };
    }
  }
  return null;
}
