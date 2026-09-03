import type { CalEvent } from "@/lib/google";
import { fmt12 } from "@/lib/nlp";
import { timeInTz, todayInTz } from "@/lib/tz";

/** " at 3:00 PM" when a todo carries a time, else "". */
function atTime(t: Todo): string {
  return t.due_time ? ` at ${fmt12(t.due_time)}` : "";
}

/** YYYY-MM-DD for the local day after `today`. */
function nextDay(today: string): string {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
import type { Idea, Project, Todo } from "@/lib/types";

export const PLAN_MODEL = "claude-haiku-4-5";

export type PlanMode = "day" | "night";

export interface PlanContext {
  /** Legacy: the cron still tags its context "night". The in-app screen is one mode. */
  mode?: PlanMode;
  todos: Todo[];
  projects: Project[];
  events: CalEvent[];
  googleConnected: boolean;
  tz: string;
  doneToday?: Todo[];
  staleIdea?: Idea | null;
  tomorrowEvents?: CalEvent[];
  /** Loose ideas from Capture — so the chat can answer "did I note anything about X". */
  ideas?: Idea[];
  /** Permanent reference facts (rent dates, account details, …). */
  reference?: { label: string | null; body: string }[];
}

/** Open todos that were due today or earlier and didn't get done — they "roll" to tomorrow. */
export function rollingTomorrow(todos: Todo[], today: string): Todo[] {
  return todos.filter(
    (t) => t.status === "open" && t.due_date != null && t.due_date <= today,
  );
}

export function goodnightMessage(ctx: PlanContext): string {
  const today = todayInTz(ctx.tz);
  const done = ctx.doneToday ?? [];
  const rolling = rollingTomorrow(ctx.todos, today);

  const parts: string[] = [];
  parts.push(
    done.length
      ? `You closed ${done.length} thing${done.length > 1 ? "s" : ""} today${
          done.length >= 4 ? " — a good run" : ""
        }.`
      : "A quiet one today.",
  );
  parts.push(
    rolling.length
      ? `${rolling.length} roll${rolling.length > 1 ? "" : "s"} to tomorrow: ${rolling
          .slice(0, 3)
          .map((t) => `${t.title}${atTime(t)}`)
          .join(", ")}${rolling.length > 3 ? "…" : ""}.`
      : "Nothing left hanging.",
  );

  // What's already on the plate for tomorrow: tasks due then + calendar.
  const tmr = nextDay(today);
  const dueTmr = ctx.todos.filter((t) => t.status === "open" && t.due_date === tmr);
  const evTmr = ctx.tomorrowEvents ?? [];
  if (dueTmr.length || evTmr.length) {
    const bits: string[] = [];
    if (evTmr.length) {
      bits.push(
        evTmr
          .slice(0, 3)
          .map((e) => `${e.allDay ? "all day" : timeInTz(e.start, ctx.tz)} ${e.title}`)
          .join(", ") + (evTmr.length > 3 ? "…" : ""),
      );
    }
    if (dueTmr.length) {
      bits.push(
        `${dueTmr.length} task${dueTmr.length > 1 ? "s" : ""} due (${dueTmr
          .slice(0, 3)
          .map((t) => `${t.title}${atTime(t)}`)
          .join(", ")}${dueTmr.length > 3 ? "…" : ""})`,
      );
    }
    parts.push(`Tomorrow: ${bits.join("; ")}.`);
  } else {
    parts.push("Tomorrow's clear so far.");
  }
  if (ctx.staleIdea) {
    const when = new Date(ctx.staleIdea.created_at).toLocaleDateString("en-US", {
      timeZone: ctx.tz,
      month: "short",
      day: "numeric",
    });
    parts.push(
      `One from your ideas (${when}): “${ctx.staleIdea.body}”. Still worth doing?`,
    );
  }
  parts.push("Anything you want to move or note before bed?");
  return parts.join("\n\n");
}

/** Project ids that have a calendar event today — matched by the project name
 *  showing up in an event title. Pure in-memory over data we already have. */
export function projectsWithEventToday(
  events: CalEvent[],
  projects: Project[],
): Set<string> {
  const out = new Set<string>();
  for (const p of projects) {
    const name = p.name.trim().toLowerCase();
    if (name.length < 3) continue; // too short to match safely
    if (events.some((e) => e.title?.toLowerCase().includes(name))) out.add(p.id);
  }
  return out;
}

/** Explicit priority order (from the build brief — not left to the model to guess). */
export function rankToday(
  todos: Todo[],
  today: string,
  eventProjectIds: Set<string> = new Set(),
) {
  const score = (t: Todo): number => {
    if (t.due_date && t.due_date < today) return 0; // overdue
    if (t.due_date === today) return 1; // due today
    if (t.project_id && eventProjectIds.has(t.project_id)) return 2; // project has an event today
    if (t.flagged) return 3; // manually flagged
    return 4;
  };
  return todos
    .filter((t) => t.status === "open")
    .filter((t) => score(t) < 4)
    .sort((a, b) => score(a) - score(b) || (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
}

function dayPart(tz: string): string {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(
      new Date(),
    ),
  ) % 24;
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/** Tasks + calendar already sitting on tomorrow, as one sentence — or null if it's clear. */
function tomorrowLine(ctx: PlanContext, today: string): string | null {
  const tmr = nextDay(today);
  const dueTmr = ctx.todos.filter((t) => t.status === "open" && t.due_date === tmr);
  const evTmr = ctx.tomorrowEvents ?? [];
  if (!dueTmr.length && !evTmr.length) return null;
  const bits: string[] = [];
  if (evTmr.length) {
    bits.push(
      evTmr
        .slice(0, 3)
        .map((e) => `${e.allDay ? "all day" : timeInTz(e.start, ctx.tz)} ${e.title}`)
        .join(", ") + (evTmr.length > 3 ? "…" : ""),
    );
  }
  if (dueTmr.length) {
    bits.push(
      `${dueTmr.length} task${dueTmr.length > 1 ? "s" : ""} due (${dueTmr
        .slice(0, 3)
        .map((t) => `${t.title}${atTime(t)}`)
        .join(", ")}${dueTmr.length > 3 ? "…" : ""})`,
    );
  }
  return `Tomorrow already has ${bits.join("; ")}.`;
}

function tagFor(t: Todo, today: string, eventProjectIds: Set<string>): string {
  const tag =
    t.due_date && t.due_date < today
      ? "overdue"
      : t.due_date === today
        ? "due today"
        : t.project_id && eventProjectIds.has(t.project_id)
          ? "meeting today"
          : t.flagged
            ? "flagged"
            : "";
  return tag ? ` (${tag})` : "";
}

/** One continuous briefing — priorities now, what's already done, what's on for tomorrow. */
export function openingMessage(ctx: PlanContext): string {
  const today = todayInTz(ctx.tz);
  const eventProjectIds = projectsWithEventToday(ctx.events, ctx.projects);
  const ranked = rankToday(ctx.todos, today, eventProjectIds);
  const done = ctx.doneToday ?? [];
  const pname = (id: string | null) =>
    id ? (ctx.projects.find((p) => p.id === id)?.name ?? "—") : "no project";

  const part = dayPart(ctx.tz);
  const hi = part === "morning" ? "Good morning." : part === "afternoon" ? "Good afternoon." : "Evening.";

  // Calendar: drop events that ended 2h+ ago; mark ones just past as done.
  const now = Date.now();
  const shownEvents = ctx.events.filter(
    (e) => e.allDay || new Date(e.end).getTime() >= now - 2 * 3600_000,
  );
  const calList = shownEvents
    .map((e) => {
      if (e.allDay) return `all day ${e.title}`;
      const past = new Date(e.end).getTime() < now;
      return `${timeInTz(e.start, ctx.tz)} ${e.title}${past ? " (done)" : ""}`;
    })
    .join(", ");

  const parts: string[] = [];

  // 1. the lead — what wants attention, with the calendar folded in when it's light
  if (ranked.length === 1) {
    const t = ranked[0];
    parts.push(`${hi} One thing worth starting with — ${t.title}${atTime(t)}${tagFor(t, today, eventProjectIds)}.`);
  } else if (ranked.length > 1) {
    const lines = ranked.slice(0, 6).map((t) => {
      const proj = t.project_id ? ` · ${pname(t.project_id)}` : "";
      return `· ${t.title}${atTime(t)}${proj}${tagFor(t, today, eventProjectIds)}`;
    });
    parts.push(`${hi} A few things want attention:\n${lines.join("\n")}`);
  } else if (shownEvents.length) {
    parts.push(`${hi} Nothing pressing on the list — but the calendar has ${calList}.`);
  } else {
    parts.push(`${hi} Nothing on the list and the calendar's clear. An easy one.`);
  }

  // 2. calendar as its own line only when there were tasks above
  if (ranked.length && shownEvents.length) {
    parts.push(`Calendar: ${calList}.`);
  }

  // 3. what's already behind you (afternoon / evening only — odd to say in the morning)
  if (done.length && part !== "morning") {
    parts.push(
      `You've already cleared ${done.length} today${done.length >= 4 ? " — good run" : ""}.`,
    );
  }

  // 4. what's already waiting on tomorrow
  const tmr = tomorrowLine(ctx, today);
  if (tmr) parts.push(tmr);

  // 5. an old idea, if one's gone stale
  if (ctx.staleIdea) {
    const when = new Date(ctx.staleIdea.created_at).toLocaleDateString("en-US", {
      timeZone: ctx.tz,
      month: "short",
      day: "numeric",
    });
    parts.push(`An older idea, still sitting since ${when}: “${ctx.staleIdea.body}”.`);
  }

  parts.push(
    part === "evening" ? "Anything you want to shift before calling it?" : "Where do you want to start?",
  );
  return parts.join("\n\n");
}

export function buildSystemPrompt(ctx: PlanContext): string {
  const today = todayInTz(ctx.tz);
  const proj = (id: string | null) =>
    id ? (ctx.projects.find((p) => p.id === id)?.name ?? "—") : "no project";

  const todoLines = ctx.todos
    .filter((t) => t.status === "open" || t.status === "waiting")
    .map((t) => {
      const bits = [
        `id=${t.id}`,
        `"${t.title}"`,
        `project=${proj(t.project_id)}`,
        t.due_date ? `due=${t.due_date}${t.due_time ? ` ${t.due_time}` : ""}` : "no due date",
        t.status === "waiting" ? "WAITING on someone" : null,
        t.flagged ? "FLAGGED" : null,
        t.recurrence ? "recurring" : null,
      ].filter(Boolean);
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");

  const eventLines = ctx.events.length
    ? ctx.events
        .map(
          (e) =>
            `- id=${e.id} "${e.title}" ${e.allDay ? "all day" : `${e.start} → ${e.end}`}`,
        )
        .join("\n")
    : "(none)";

  const doneLines = (ctx.doneToday ?? [])
    .map((t) => `- "${t.title}"`)
    .join("\n");
  const rolling = rollingTomorrow(ctx.todos, today);
  const rollingLines = rolling.map((t) => `- id=${t.id} "${t.title}"`).join("\n");

  const tmr = nextDay(today);
  const dueTmr = ctx.todos.filter((t) => t.status === "open" && t.due_date === tmr);
  const tomorrowLines = [
    ...(ctx.tomorrowEvents ?? []).map(
      (e) => `- ${e.allDay ? "all day" : `${e.start} → ${e.end}`} "${e.title}"`,
    ),
    ...dueTmr.map(
      (t) => `- task due: id=${t.id} "${t.title}"${t.due_time ? ` at ${t.due_time}` : ""}`,
    ),
  ].join("\n");

  const role = `You are Haru, a calm daily companion for one person. Today is ${today} (timezone ${ctx.tz}), ${dayPart(ctx.tz)}.

Your job: help them decide what to work on, surface conflicts between their tasks and calendar, note what's already done, flag what's on for tomorrow, and make small changes when asked. In the evening this naturally reads more like a wind-down than a kickoff — follow the time of day. Be brief and warm — a sentence or two per reply, not paragraphs. Ask one thing at a time. You may resurface the stale idea below if it fits the moment.

DONE TODAY:
${doneLines || "(nothing logged yet)"}

ROLLING (open, was due today or earlier):
${rollingLines || "(none)"}

ALREADY ON FOR TOMORROW (${tmr}):
${tomorrowLines || "(nothing scheduled)"}
${ctx.staleIdea ? `\nSTALE IDEA you may resurface: "${ctx.staleIdea.body}"` : ""}

PRIORITY ORDER (use this exact order when suggesting what to do first):
1. Overdue todos
2. Todos due today
3. Todos tied to a project that has a calendar event today
4. Todos the user manually flagged
Present the ranked list only when asked or at the very start; after that, follow the user's lead.

You can act by calling tools. Rules:
- add_todo: create a task when asked ("add a, b, c" → one call each). complete_todo / reschedule_todo act on existing ones.
- get_events: look up calendar for any date range — use it for "am I free Thursday", "what's on next week".
- create_event / move_event: only when the user clearly asks or agrees.
- Never delete anything. There is no delete tool by design.
- After any change, briefly confirm what you did.
- Dates are YYYY-MM-DD. Event times are full ISO 8601 with a timezone offset (use ${ctx.tz}).
- If the user asks for something you have no tool for (e.g. deleting an event), tell them to do it in Google Calendar.

TODAY'S OPEN TODOS:
${todoLines || "(none)"}

TODAY'S CALENDAR EVENTS:
${eventLines}
${ctx.googleConnected ? "For any other day, call get_events with a date range." : "\n(Calendar is not connected — create_event / move_event / get_events are unavailable.)"}

LOOSE IDEAS (from Capture, not yet tasks):
${(ctx.ideas ?? []).map((i) => `- "${i.body}"`).join("\n") || "(none)"}

REFERENCE FACTS (things the user has told you to remember — treat as reliable):
${
  (ctx.reference ?? [])
    .map((r) => `- ${r.label ? `${r.label}: ` : ""}${r.body}`)
    .join("\n") || "(none)"
}
Use save_reference when the user gives you a durable fact to remember.`;

  return role;
}
