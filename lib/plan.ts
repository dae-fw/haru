import type { CalEvent } from "@/lib/google";
import { timeInTz, todayInTz } from "@/lib/tz";
import type { Project, Todo } from "@/lib/types";

export const PLAN_MODEL = "claude-haiku-4-5";

export interface PlanContext {
  todos: Todo[];
  projects: Project[];
  events: CalEvent[];
  googleConnected: boolean;
  tz: string;
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

  return `You are Haru, a calm daily planning assistant for one person. Today is ${today} (timezone ${ctx.tz}).

Your job: help them decide what to work on, surface conflicts between their tasks and calendar, and make small changes when asked. Be brief and warm — a sentence or two per reply, not paragraphs. Ask one question at a time.

PRIORITY ORDER (use this exact order when suggesting what to do first):
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
