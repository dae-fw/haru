import { createAdminClient } from "@/lib/supabase/admin";
import { goodnightMessage, type PlanContext } from "@/lib/plan";
import { sendPush, type PushSub } from "@/lib/push";
import { todayInTz } from "@/lib/tz";
import type { Idea, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

async function handler(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const admin = createAdminClient();

  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = userList?.users.find((u) => u.email?.toLowerCase() === ALLOWED);
  if (!user) return Response.json({ error: "no user" }, { status: 404 });

  const tz =
    (user.user_metadata?.tz as string | undefined) || process.env.HARU_TZ || "UTC";
  const today = todayInTz(tz);

  const [{ data: openRaw }, { data: doneRaw }, { data: ideaRaw }] = await Promise.all([
    admin
      .from("haru_todos")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["open", "waiting"]),
    admin
      .from("haru_todos")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("completed_at", `${today}T00:00:00`),
    admin
      .from("haru_ideas")
      .select("*")
      .eq("user_id", user.id)
      .lt("created_at", new Date(Date.now() - 10 * 864e5).toISOString())
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const ideas = (ideaRaw ?? []) as Idea[];
  const ctx: PlanContext = {
    mode: "night",
    todos: (openRaw ?? []) as Todo[],
    projects: [],
    events: [],
    googleConnected: false,
    tz,
    doneToday: (doneRaw ?? []) as Todo[],
    staleIdea: ideas.length ? ideas[Math.floor(Math.random() * ideas.length)] : null,
  };

  const body = goodnightMessage(ctx).split("\n\n").slice(0, 3).join(" ");

  const { data: subsRaw } = await admin
    .from("haru_push_subs")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  const subs = (subsRaw ?? []) as PushSub[];
  if (subs.length === 0) return Response.json({ sent: 0, note: "no subscriptions" });

  const { sent, stale } = await sendPush(subs, {
    title: "Goodnight",
    body,
    url: "/plan?m=night",
    tag: "haru-goodnight",
  });
  if (stale.length) await admin.from("haru_push_subs").delete().in("endpoint", stale);

  return Response.json({ sent, stale: stale.length });
}

export const GET = handler;
export const POST = handler;
