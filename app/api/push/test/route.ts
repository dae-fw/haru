import { requireUser } from "@/lib/auth";
import { sendPush, type PushSub } from "@/lib/push";

export async function POST() {
  const { user, supabase } = await requireUser();
  const { data } = await supabase
    .from("haru_push_subs")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  const subs = (data ?? []) as PushSub[];
  if (subs.length === 0) {
    return Response.json({ error: "no subscription" }, { status: 400 });
  }
  const { sent, stale } = await sendPush(subs, {
    title: "Haru",
    body: "Test notification — you're all set.",
    url: "/",
    tag: "haru-test",
  });
  if (stale.length) {
    await supabase.from("haru_push_subs").delete().in("endpoint", stale);
  }
  return Response.json({ sent });
}
