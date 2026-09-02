import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. Server-only, never expose.
 * Used by the cron route, which has no user session.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
