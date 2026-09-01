import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: Request) {
  const { user, supabase } = await requireUser();
  const { searchParams, origin } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("g_oauth_state")?.value;
  jar.delete("g_oauth_state");

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${siteUrl}/settings?gcal=error`);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${siteUrl}/connect/google/callback`,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    console.error("google code exchange failed", await res.text());
    return NextResponse.redirect(`${siteUrl}/settings?gcal=error`);
  }
  const t = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  if (!t.refresh_token) {
    // Google only returns refresh_token on first consent; prompt=consent forces it.
    return NextResponse.redirect(`${siteUrl}/settings?gcal=norefresh`);
  }

  await supabase.from("haru_google_tokens").upsert({
    user_id: user.id,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    scope: t.scope,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  });

  return NextResponse.redirect(`${siteUrl}/settings?gcal=connected`);
}
