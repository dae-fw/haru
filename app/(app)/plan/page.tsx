import { requireUser } from "@/lib/auth";
import { getDoneToday, getIdeas, getOpenTodos, getProjects } from "@/lib/data";
import { getTodayEvents, getTomorrowEvents, isGoogleConnected } from "@/lib/google";
import { getTimeZone } from "@/lib/tz.server";
import { hourInTz } from "@/lib/tz";
import { openingMessage, type PlanContext, type PlanMode } from "@/lib/plan";
import PlanChat from "@/components/PlanChat";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await requireUser();
  const [{ m }, tz] = await Promise.all([searchParams, getTimeZone()]);
  // One continuous conversation — it just leans "recap" in the evening.
  // ?m= still forces a mode (the goodnight push links to ?m=night).
  const mode: PlanMode =
    m === "night" ? "night" : m === "day" ? "day" : hourInTz(tz) >= 18 ? "night" : "day";

  const [projects, todos, connected] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    isGoogleConnected(),
  ]);
  const events = mode === "day" && connected ? await getTodayEvents(tz) : [];

  let doneToday, staleIdea, tomorrowEvents;
  if (mode === "night") {
    const [done, ideas, tmr] = await Promise.all([
      getDoneToday(),
      getIdeas(),
      connected ? getTomorrowEvents(tz) : Promise.resolve([]),
    ]);
    doneToday = done;
    tomorrowEvents = tmr;
    const cutoff = Date.now() - 10 * 864e5;
    const old = ideas.filter((i) => new Date(i.created_at).getTime() < cutoff);
    staleIdea = old.length ? old[Math.floor(Math.random() * old.length)] : null;
  }

  const ctx: PlanContext = {
    mode,
    todos,
    projects,
    events,
    googleConnected: connected,
    tz,
    doneToday,
    staleIdea,
    tomorrowEvents,
  };

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Plan · Haiku 4.5</div>
        <h1>{mode === "night" ? "Goodnight recap" : "Plan the day together"}</h1>
        <div className="sub">
          {mode === "night"
            ? "What got done, and what's on for tomorrow"
            : `Knows your todos${connected ? " and calendar" : ""}`}
          {" · "}
          <a href={mode === "night" ? "/plan?m=day" : "/plan?m=night"} className="linkish">
            {mode === "night" ? "plan the day instead" : "goodnight recap instead"}
          </a>
        </div>
        <Gear />
      </header>
      <div className="body plan-body">
        <PlanChat opening={openingMessage(ctx)} mode={mode} />
      </div>
    </>
  );
}
