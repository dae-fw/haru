import { createAdminClient } from "@/lib/supabase/admin";
import { rankToday } from "@/lib/plan";
import { sendPush, type PushSub } from "@/lib/push";
import { todayInTz } from "@/lib/tz";
import type { Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true; // Vercel Cron
  const key = new URL(req.url).searchParams.get("key");
  return key === secret; // manual test
}

async function handler(req: Request) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });

  const admin = createAdminClient();

  // the single allowed user
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
  const today = todayInTz(tz);

  const { data: todosRaw } = await admin
    .from("haru_todos")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["open", "waiting"]);
  const todos = (todosRaw ?? []) as Todo[];
  const ranked = rankToday(todos, today);
  const overdue = ranked.filter((t) => t.due_date && t.due_date < today).length;

  const body =
    ranked.length === 0
      ? "Nothing pressing today. Enjoy it."
      : `Start with: ${ranked
          .slice(0, 3)
          .map((t, i) => `${i + 1}) ${t.title}`)
          .join("  ")}${overdue ? `  ·  ${overdue} overdue` : ""}`;

  const { data: subsRaw } = await admin
    .from("haru_push_subs")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  const subs = (subsRaw ?? []) as PushSub[];
  if (subs.length === 0) return Response.json({ sent: 0, note: "no subscriptions" });

  const { sent, stale } = await sendPush(subs, {
    title: "Good morning",
    body,
    url: "/",
    tag: "haru-morning",
  });
  if (stale.length) {
    await admin.from("haru_push_subs").delete().in("endpoint", stale);
  }

  return Response.json({ sent, stale: stale.length, ranked: ranked.length });
}

export const GET = handler;
export const POST = handler;
