import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();

// Exchanges the OAuth code for a session, then sends the user home.
// Rejects any account other than HARU_ALLOWED_EMAIL before a session sticks.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const email = data.user?.email?.toLowerCase();
      if (ALLOWED && email !== ALLOWED) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?denied=1`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?denied=1`);
}
