import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();

export interface HaruUser {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
}

/**
 * Gate for every protected Server Component / Action.
 *
 * Uses getClaims() — if the Supabase project has migrated to asymmetric JWT
 * signing keys this verifies the token locally (no network). Otherwise it
 * transparently falls back to a getUser() call. Wrapped in cache() so the
 * layout + page + actions of one request share a single check.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { sub: string; email?: string; user_metadata?: Record<string, unknown> }
    | undefined;

  if (error || !claims?.sub) redirect("/login");

  const email = claims.email ?? null;
  if (ALLOWED && email?.toLowerCase() !== ALLOWED) redirect("/login");

  const user: HaruUser = {
    id: claims.sub,
    email,
    user_metadata: claims.user_metadata ?? {},
  };
  return { user, supabase };
});
