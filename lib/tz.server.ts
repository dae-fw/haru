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
