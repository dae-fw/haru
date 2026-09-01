import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { GOOGLE_SCOPES } from "@/lib/google";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  await requireUser();
  const { origin } = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin;

  const state = crypto.randomUUID();
  (await cookies()).set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${siteUrl}/connect/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return NextResponse.redirect(`${AUTH_URL}?${params}`);
}
