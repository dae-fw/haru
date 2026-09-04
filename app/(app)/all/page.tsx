import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDoneToday, getOpenTodos, getProjects, isWaiting } from "@/lib/data";
import { todayISO } from "@/lib/recurrence";
import { FILTER_KEYS, PREDS, plusDaysISO } from "@/lib/allview";
import AllBody from "@/components/AllBody";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function AllPage() {
  await requireUser();
  const [projects, open, doneToday] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    getDoneToday(),
  ]);
  const today = todayISO();
  const wk = plusDaysISO(7);

  const active = open.filter((t) => !isWaiting(t));
  const waiting = open.filter(isWaiting);

  const counts: Record<string, number> = {};
  for (const key of FILTER_KEYS) {
    counts[key] =
      key === "all" ? 0 : active.filter((t) => PREDS[key](t, today, wk)).length;
  }

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">All todos</div>
        <h1>The full list</h1>
        <div className="sub">
          {active.length} open{waiting.length ? ` · ${waiting.length} waiting` : ""}
        </div>
        <Gear />
      </header>

      <Suspense fallback={<div className="body" />}>
        <AllBody
          active={active}
          waiting={waiting}
          doneToday={doneToday}
          projects={projects}
          counts={counts}
        />
      </Suspense>
    </>
  );
}
