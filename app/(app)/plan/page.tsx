import { requireUser } from "@/lib/auth";
import { getDoneToday, getIdeas, getOpenTodos, getProjects } from "@/lib/data";
import { getTodayEvents, getTomorrowEvents, isGoogleConnected } from "@/lib/google";
import { getTimeZone } from "@/lib/tz.server";
import { hourInTz } from "@/lib/tz";
import { openingMessage, type PlanContext } from "@/lib/plan";
import PlanChat from "@/components/PlanChat";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  await requireUser();
  const tz = await getTimeZone();
  const evening = hourInTz(tz) >= 18;

  const [projects, todos, connected, ideas] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    isGoogleConnected(),
    getIdeas(),
  ]);
  const [events, tomorrowEvents, doneToday] = await Promise.all([
    connected ? getTodayEvents(tz) : Promise.resolve([]),
    connected ? getTomorrowEvents(tz) : Promise.resolve([]),
    getDoneToday(),
  ]);

  const cutoff = Date.now() - 10 * 864e5;
  const old = ideas.filter((i) => new Date(i.created_at).getTime() < cutoff);
  const staleIdea = old.length ? old[Math.floor(Math.random() * old.length)] : null;

  const ctx: PlanContext = {
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
        <div className="eyebrow">Chat · Haiku 4.5</div>
        <h1>{evening ? "Wind down together" : "What's the plan?"}</h1>
        <div className="sub">
          Knows your todos{connected ? ", calendar" : ""}, ideas and reference notes
        </div>
        <Gear />
      </header>
      <div className="body plan-body">
        <PlanChat opening={openingMessage(ctx)} />
      </div>
    </>
  );
}
