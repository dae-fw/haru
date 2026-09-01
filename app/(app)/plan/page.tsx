import { requireUser } from "@/lib/auth";
import { getOpenTodos, getProjects } from "@/lib/data";
import { getTodayEvents, isGoogleConnected } from "@/lib/google";
import { getTimeZone } from "@/lib/tz";
import { openingMessage, type PlanContext } from "@/lib/plan";
import PlanChat from "@/components/PlanChat";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  await requireUser();
  const tz = await getTimeZone();
  const [projects, todos, connected] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    isGoogleConnected(),
  ]);
  const events = connected ? await getTodayEvents(tz) : [];
  const ctx: PlanContext = { todos, projects, events, googleConnected: connected, tz };

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Plan · Haiku 4.5</div>
        <h1>Plan the day together</h1>
        <div className="sub">Knows your todos{connected ? " and calendar" : ""}</div>
        <Gear />
      </header>
      <div className="body plan-body">
        <PlanChat opening={openingMessage(ctx)} />
      </div>
    </>
  );
}
