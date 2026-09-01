import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();

/**
 * Use at the top of every protected Server Component / Action.
 * Wrapped in cache() so the layout + page + actions in one request share a
 * single auth round-trip instead of hitting the Supabase auth server each time.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (ALLOWED && user.email?.toLowerCase() !== ALLOWED)) {
    redirect("/login");
  }
  return { user, supabase };
});
