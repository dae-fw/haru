import type { CalEvent } from "@/lib/google";
import { timeInTz, todayInTz } from "@/lib/tz";

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
  mode: PlanMode;
  todos: Todo[];
  projects: Project[];
  events: CalEvent[];
  googleConnected: boolean;
  tz: string;
  doneToday?: Todo[];
  staleIdea?: Idea | null;
  tomorrowEvents?: CalEvent[];
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
          .map((t) => t.title)
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
          .map((t) => t.title)
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

/** Explicit priority order (from the build brief — not left to the model to guess). */
export function rankToday(todos: Todo[], today: string) {
  const score = (t: Todo): number => {
    if (t.due_date && t.due_date < today) return 0; // overdue
    if (t.due_date === today) return 1; // due today
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

export function openingMessage(ctx: PlanContext): string {
  if (ctx.mode === "night") return goodnightMessage(ctx);
  const today = todayInTz(ctx.tz);
  const ranked = rankToday(ctx.todos, today);
  const pname = (id: string | null) =>
    id ? (ctx.projects.find((p) => p.id === id)?.name ?? "—") : "no project";

  if (ranked.length === 0 && ctx.events.length === 0) {
    return `Good ${dayPart(ctx.tz)}. Nothing's pressing today — clear list, no events. Anything you want to line up for later this week?`;
  }

  const lines: string[] = [];
  ranked.slice(0, 6).forEach((t, i) => {
    const tag =
      t.due_date && t.due_date < today
        ? "overdue"
        : t.due_date === today
          ? "due today"
          : t.flagged
            ? "flagged"
            : "";
    lines.push(`${i + 1}. ${t.title} — ${pname(t.project_id)}${tag ? ` (${tag})` : ""}`);
  });

  const evLine = ctx.events.length
    ? `\n\nOn the calendar: ${ctx.events
        .map((e) => `${e.allDay ? "all day" : timeInTz(e.start, ctx.tz)} ${e.title}`)
        .join(", ")}.`
    : "";

  const body = lines.length
    ? `Here's the order I'd go in:\n\n${lines.join("\n")}`
    : "No ranked tasks, but there's stuff on the calendar.";

  return `Good ${dayPart(ctx.tz)}. ${body}${evLine}\n\nWhat do you want to start with?`;
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
        t.due_date ? `due=${t.due_date}` : "no due date",
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
    ...dueTmr.map((t) => `- task due: id=${t.id} "${t.title}"`),
  ].join("\n");

  const role =
    ctx.mode === "night"
      ? `You are Haru, winding down the day with one person. It is evening on ${today} (timezone ${ctx.tz}).

Your job: a short recap — what got done, what's rolling over, and what's already on for tomorrow — then help them move or note anything before bed. Optionally resurface the stale idea below if it fits. Be brief and warm; one or two sentences per reply. Ask one thing at a time.

DONE TODAY:
${doneLines || "(nothing logged)"}

ROLLING TO TOMORROW (open, was due today or earlier):
${rollingLines || "(none)"}

ALREADY ON FOR TOMORROW (${tmr}) — mention this so they know what they're walking into:
${tomorrowLines || "(nothing scheduled)"}
${ctx.staleIdea ? `\nSTALE IDEA you may resurface: "${ctx.staleIdea.body}"` : ""}

PRIORITY ORDER (for anything they want to reprioritise):`
      : `You are Haru, a calm daily planning assistant for one person. Today is ${today} (timezone ${ctx.tz}).

Your job: help them decide what to work on, surface conflicts between their tasks and calendar, and make small changes when asked. Be brief and warm — a sentence or two per reply, not paragraphs. Ask one question at a time.

PRIORITY ORDER (use this exact order when suggesting what to do first):`;

  return `${role}
1. Overdue todos
2. Todos due today
3. Todos tied to a project that has a calendar event today
4. Todos the user manually flagged
Present the ranked list only when asked or at the very start; after that, follow the user's lead.

You can act by calling tools. Rules:
- Only reschedule / complete / create / move when the user clearly asks or agrees.
- Never delete anything. There is no delete tool by design.
- When you complete or reschedule, briefly confirm what you did.
- Dates are YYYY-MM-DD. Event times are full ISO 8601 with a timezone offset (use ${ctx.tz}).
- If the user asks for something you have no tool for (e.g. deleting an event), tell them to do it in Google Calendar.

TODAY'S OPEN TODOS:
${todoLines || "(none)"}

TODAY'S CALENDAR EVENTS:
${eventLines}
${ctx.googleConnected ? "" : "\n(Calendar is not connected — create_event / move_event are unavailable.)"}`;
}
