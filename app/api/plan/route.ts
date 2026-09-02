import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getDoneToday, getIdeas, getOpenTodos, getProjects } from "@/lib/data";
import { getTodayEvents, isGoogleConnected, createCalendarEvent, moveCalendarEvent } from "@/lib/google";
import { getTimeZone } from "@/lib/tz.server";
import { buildSystemPrompt, PLAN_MODEL, type PlanContext, type PlanMode } from "@/lib/plan";
import {
  completeTodo,
  rescheduleTodo,
} from "@/app/(app)/actions";

const MAX_STEPS = 6;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Msg = Anthropic.MessageParam;

export async function POST(req: Request) {
  await requireUser();

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      reply:
        "The planning chat isn't switched on yet — add ANTHROPIC_API_KEY in Vercel and redeploy.",
      actions: [],
    });
  }

  const body = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    mode?: string;
  };
  const mode: PlanMode = body.mode === "night" ? "night" : "day";
  const history: Msg[] = (body.messages ?? [])
    .filter((m) => m.content?.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ reply: "", actions: [] }, { status: 400 });
  }

  const tz = await getTimeZone();
  const [projects, todos, connected] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    isGoogleConnected(),
  ]);
  const events = mode === "day" && connected ? await getTodayEvents(tz) : [];

  let doneToday, staleIdea;
  if (mode === "night") {
    const [done, ideas] = await Promise.all([getDoneToday(), getIdeas()]);
    doneToday = done;
    const cutoff = Date.now() - 10 * 864e5;
    const old = ideas.filter((i) => new Date(i.created_at).getTime() < cutoff);
    staleIdea = old.length ? old[Math.floor(Math.random() * old.length)] : null;
  }

  const ctx: PlanContext = {
    mode,
    todos,
    projects,
    events,
    googleConnected: connected,
    tz,
    doneToday,
    staleIdea,
  };

  const tools: Anthropic.Tool[] = [
    {
      name: "complete_todo",
      description: "Mark a todo as done. Use the exact id from the system prompt.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: { todo_id: { type: "string" } },
        required: ["todo_id"],
      },
      strict: true,
    },
    {
      name: "reschedule_todo",
      description: "Change a todo's due date. due_date is YYYY-MM-DD.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          todo_id: { type: "string" },
          due_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["todo_id", "due_date"],
      },
      strict: true,
    },
  ];
  if (connected) {
    tools.push(
      {
        name: "create_event",
        description:
          "Create a calendar event on the primary calendar. start/end are full ISO 8601 with offset.",
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
          },
          required: ["title", "start", "end"],
        },
        strict: true,
      },
      {
        name: "move_event",
        description: "Move an existing event. event_id from the system prompt; start/end ISO 8601.",
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            event_id: { type: "string" },
            start: { type: "string" },
            end: { type: "string" },
          },
          required: ["event_id", "start", "end"],
        },
        strict: true,
      },
    );
  }

  const client = new Anthropic();
  const messages: Msg[] = [...history];
  const actions: string[] = [];
  let mutated = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: PLAN_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(ctx),
      tools,
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (mutated) {
        revalidatePath("/");
        revalidatePath("/all");
      }
      return Response.json({ reply, actions });
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, string>;
      let content = "ok";
      let isError = false;
      try {
        if (block.name === "complete_todo") {
          await completeTodo(input.todo_id);
          const t = todos.find((x) => x.id === input.todo_id);
          actions.push(`Completed “${t?.title ?? "todo"}”`);
          mutated = true;
        } else if (block.name === "reschedule_todo") {
          if (!ISO_DATE.test(input.due_date)) throw new Error("due_date must be YYYY-MM-DD");
          await rescheduleTodo(input.todo_id, input.due_date);
          const t = todos.find((x) => x.id === input.todo_id);
          actions.push(`Moved “${t?.title ?? "todo"}” → ${input.due_date}`);
          mutated = true;
        } else if (block.name === "create_event") {
          const ev = await createCalendarEvent({
            title: input.title,
            start: input.start,
            end: input.end,
          });
          if (!ev) throw new Error("calendar create failed");
          actions.push(`Added event “${input.title}”`);
        } else if (block.name === "move_event") {
          const ev = await moveCalendarEvent(input.event_id, {
            start: input.start,
            end: input.end,
          });
          if (!ev) throw new Error("calendar move failed");
          actions.push(`Moved event`);
        } else {
          content = "unknown tool";
          isError = true;
        }
      } catch (e) {
        content = e instanceof Error ? e.message : "tool failed";
        isError = true;
      }
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content,
        is_error: isError,
      });
    }
    messages.push({ role: "user", content: results });
  }

  return Response.json({
    reply: "That got complicated — try asking one step at a time.",
    actions,
  });
}
