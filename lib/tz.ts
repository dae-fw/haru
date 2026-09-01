import { cookies } from "next/headers";

const IANA = /^[A-Za-z]+(?:[_-][A-Za-z]+)*\/[A-Za-z0-9]+(?:[_+\-/][A-Za-z0-9]+)*$/;

/** The viewer's IANA timezone from the haru_tz cookie (set client-side by <TzSync/>). Falls back to UTC. */
export async function getTimeZone(): Promise<string> {
  try {
    const tz = (await cookies()).get("haru_tz")?.value;
    if (tz && (tz === "UTC" || IANA.test(tz))) return tz;
  } catch {
    /* cookies() unavailable — ignore */
  }
  return "UTC";
}

/** yyyy-mm-dd for "now" in the given timezone. */
export function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/** Hour 0–23 for "now" in the given timezone. */
export function hourInTz(tz: string): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(s, 10) % 24;
}

/** Local clock time for an instant, in the given timezone (e.g. "9:16 AM"). */
export function timeInTz(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}
