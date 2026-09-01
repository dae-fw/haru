import type { Project } from "@/lib/types";

export interface ParsedTodo {
  title: string;
  dueDate?: string; // yyyy-mm-dd (local)
  projectId?: string;
  flagged?: boolean;
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

  // --- date ---
  const date = extractDate(text);
  if (date) {
    out.dueDate = date.iso;
    hints.push(`due ${labelFor(date.iso)}`);
    text = text.replace(date.match, " ");
  }

  out.title = text.replace(/\s+/g, " ").trim() || raw.trim();
  return out;
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
