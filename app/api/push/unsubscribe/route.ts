import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { supabase } = await requireUser();
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return Response.json({ error: "no endpoint" }, { status: 400 });
  await supabase.from("haru_push_subs").delete().eq("endpoint", endpoint);
  return Response.json({ ok: true });
}
