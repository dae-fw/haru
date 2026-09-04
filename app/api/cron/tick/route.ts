import { createAdminClient } from "@/lib/supabase/admin";
import { goodnightMessage, rankToday } from "@/lib/plan";
import { sendPush, type PushSub } from "@/lib/push";
import { fmt12 } from "@/lib/nlp";
import { todayInTz, tzOffset } from "@/lib/tz";
import type { Idea, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();
const MORNING = "07:30";
const GOODNIGHT = "21:00";
const WINDOW_MIN = 6; // matches the ~5-min trigger cadence plus jitter

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

function withinWindow(nowHM: string, startHM: string): boolean {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const d = toMin(nowHM) - toMin(startHM);
  return d >= 0 && d < WINDOW_MIN;
}

async function handler(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const admin = createAdminClient();

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = userList?.users.find((u) => u.email?.toLowerCase() === ALLOWED);
  if (!user) return Response.json({ error: "no user" }, { status: 404 });

  const { data: prefs } = await admin
    .from("haru_prefs")
    .select("tz")
    .eq("user_id", user.id)
    .maybeSingle();
  const tz =
    (prefs?.tz as string | undefined) ||
    (user.user_metadata?.tz as string | undefined) ||
    process.env.HARU_TZ ||
    "UTC";

  const now = new Date();
  const localDate = todayInTz(tz);
  const nowHM = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const { data: subsRaw } = await admin
    .from("haru_push_subs")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  const subs = (subsRaw ?? []) as PushSub[];

  const staleAll = new Set<string>();
  const out: Record<string, unknown> = { nowHM, localDate };

  async function ran(key: string) {
    const { data } = await admin.from("haru_cron").select("on_date").eq("key", key).maybeSingle();
    return data?.on_date === localDate;
  }
  const mark = (key: string) =>
    admin
      .from("haru_cron")
      .upsert({ key, on_date: localDate, updated_at: now.toISOString() });

  const { data: todosRaw } = await admin
    .from("haru_todos")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["open", "waiting"]);
  const todos = (todosRaw ?? []) as Todo[];

  // ---- morning nudge ----
  if (subs.length && withinWindow(nowHM, MORNING) && !(await ran("morning"))) {
    const ranked = rankToday(todos, localDate);
    const overdue = ranked.filter((t) => t.due_date && t.due_date < localDate).length;
    const body =
      ranked.length === 0
        ? "Nothing pressing today. Enjoy it."
        : `Start with: ${ranked
            .slice(0, 3)
            .map((t, i) => `${i + 1}) ${t.title}`)
            .join("  ")}${overdue ? `  ·  ${overdue} overdue` : ""}`;
    const { stale } = await sendPush(subs, {
      title: "Good morning",
      body,
      url: "/",
      tag: "haru-morning",
    });
    stale.forEach((s) => staleAll.add(s));
    await mark("morning");
    out.morning = "sent";
  }

  // ---- goodnight recap ----
  if (subs.length && withinWindow(nowHM, GOODNIGHT) && !(await ran("goodnight"))) {
    const { data: doneRaw } = await admin
      .from("haru_todos")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("completed_at", `${localDate}T00:00:00`);
    const { data: ideaRaw } = await admin
      .from("haru_ideas")
      .select("*")
      .eq("user_id", user.id)
      .lt("created_at", new Date(Date.now() - 10 * 864e5).toISOString())
      .limit(20);
    const ideas = (ideaRaw ?? []) as Idea[];
    const body = goodnightMessage({
      todos,
      tz,
      doneToday: (doneRaw ?? []) as Todo[],
      staleIdea: ideas.length ? ideas[Math.floor(Math.random() * ideas.length)] : null,
    })
      .split("\n\n")
      .slice(0, 3)
      .join(" ");
    const { stale } = await sendPush(subs, {
      title: "Goodnight",
      body,
      url: "/organize?m=tomorrow",
      tag: "haru-goodnight",
    });
    stale.forEach((s) => staleAll.add(s));
    await mark("goodnight");
    out.goodnight = "sent";
  }

  // ---- per-task reminders ----
  let remSent = 0;
  if (subs.length) {
    const off = tzOffset(tz, now);
    const due = todos.filter(
      (t) =>
        t.status === "open" &&
        t.reminder_min != null &&
        !t.reminder_sent &&
        t.due_date != null,
    );
    for (const t of due) {
      const timeStr = t.due_time ?? "09:00";
      const dueMs = Date.parse(`${t.due_date}T${timeStr}:00${off}`);
      if (Number.isNaN(dueMs)) continue;
      const fireMs = dueMs - t.reminder_min! * 60_000;
      if (now.getTime() < fireMs || now.getTime() > dueMs + 2 * 3600_000) continue;
      const { stale } = await sendPush(subs, {
        title: "Reminder",
        body: `${t.title}${t.due_time ? ` at ${fmt12(t.due_time)}` : ""}`,
        url: "/",
        tag: `haru-rem-${t.id}`,
      });
      stale.forEach((s) => staleAll.add(s));
      await admin.from("haru_todos").update({ reminder_sent: true }).eq("id", t.id);
      remSent++;
    }
  }
  out.reminders = remSent;

  if (staleAll.size) {
    await admin.from("haru_push_subs").delete().in("endpoint", [...staleAll]);
  }
  return Response.json(out);
}

export const GET = handler;
export const POST = handler;
