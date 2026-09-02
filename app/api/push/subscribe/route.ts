import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { user, supabase } = await requireUser();
  const body = (await req.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: "bad subscription" }, { status: 400 });
  }
  const { error } = await supabase.from("haru_push_subs").upsert({
    endpoint: body.endpoint,
    user_id: user.id,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
