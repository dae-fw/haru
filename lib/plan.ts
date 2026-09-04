import type { CalEvent } from "@/lib/google";
import { fmt12 } from "@/lib/nlp";
import { timeInTz, todayInTz } from "@/lib/tz";
import type { Idea, Project, Todo } from "@/lib/types";

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

/** Context for the goodnight recap push. */
export interface PlanContext {
  todos: Todo[];
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
          .map((t) => `${t.title}${atTime(t)}`)
          .join(", ")}${rolling.length > 3 ? "…" : ""}.`
      : "Nothing left hanging.",
  );

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

/** Explicit priority order (from the build brief). */
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
