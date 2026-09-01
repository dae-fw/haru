import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = (process.env.HARU_ALLOWED_EMAIL ?? "").toLowerCase().trim();

/**
 * Use at the top of every protected Server Component / Action.
 * Returns the signed-in, allow-listed user or redirects to /login.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (ALLOWED && user.email?.toLowerCase() !== ALLOWED)) {
    redirect("/login");
  }
  return { user, supabase };
}
