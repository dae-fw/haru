"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveTimeZone } from "@/app/(app)/actions";

/** Writes the browser's IANA timezone to a cookie (for server rendering) and to
 *  the user's profile (for scheduled jobs like the morning nudge). */
export default function TzSync() {
  const router = useRouter();
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith("haru_tz="))
        ?.slice("haru_tz=".length);
      if (current !== tz) {
        document.cookie = `haru_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }
      void saveTimeZone(tz);
    } catch {
      /* ignore */
    }
  }, [router]);
  return null;
}
