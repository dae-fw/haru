import { requireUser } from "@/lib/auth";
import { getOpenTodos, getProjects } from "@/lib/data";
import { getTimeZone } from "@/lib/tz.server";
import { todayInTz } from "@/lib/tz";
import {
  addDays,
  organizeQueue,
  thisWeekDate,
  type OrganizeMode,
} from "@/lib/organize";
import OrganizeRunner from "@/components/OrganizeRunner";
import Gear from "@/components/Gear";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OrganizePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  await requireUser();
  const [{ m }, tz] = await Promise.all([searchParams, getTimeZone()]);
  const [open, projects] = await Promise.all([getOpenTodos(), getProjects()]);
  const today = todayInTz(tz);

  const counts = {
    today: organizeQueue("today", open, today).length,
    tomorrow: organizeQueue("tomorrow", open, today).length,
    loose: organizeQueue("loose", open, today).length,
  };

  const mode: OrganizeMode | null =
    m === "today" || m === "tomorrow" || m === "loose" ? m : null;

  if (mode) {
    const items = organizeQueue(mode, open, today);
    return (
      <>
        <header className="screen-head">
          <div className="eyebrow">
            Organize · {mode === "loose" ? "loose ends" : mode}
          </div>
          <h1>
            {mode === "today"
              ? "What's the plan today"
              : mode === "tomorrow"
                ? "Set up tomorrow"
                : "Tidy the loose ends"}
          </h1>
          <Gear />
        </header>
        <div className="body">
          <OrganizeRunner
            mode={mode}
            items={items}
            projects={projects}
            todayISO={today}
            tomorrowISO={addDays(today, 1)}
            thisWeekISO={thisWeekDate(today)}
          />
          <Link href="/organize" className="linkish" style={{ display: "block", marginTop: 16 }}>
            ← back to Organize
          </Link>
        </div>
      </>
    );
  }

  const total = counts.today + counts.tomorrow + counts.loose;

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Organize</div>
        <h1>A quick pass through things</h1>
        <div className="sub">One card at a time — decide and move on</div>
        <Gear />
      </header>
      <div className="body">
        {total === 0 ? (
          <div className="empty">
            <div className="t">Nothing to sort</div>
            <div>Every task has a home. Come back when the pile grows.</div>
          </div>
        ) : (
          <div className="org-modes">
            <ModeButton k="today" label="Today" count={counts.today} hint="Due today + overdue" />
            <ModeButton
              k="tomorrow"
              label="Tomorrow"
              count={counts.tomorrow}
              hint="Plan the day ahead"
            />
            <ModeButton
              k="loose"
              label="Loose ends"
              count={counts.loose}
              hint="Undated or unfiled tasks"
            />
          </div>
        )}
      </div>
    </>
  );
}

function ModeButton({
  k,
  label,
  count,
  hint,
}: {
  k: string;
  label: string;
  count: number;
  hint: string;
}) {
  if (count === 0) {
    return (
      <div className="org-mode off">
        <div className="org-mode-top">
          <span>{label}</span>
          <span className="org-count">0</span>
        </div>
        <div className="org-hint">{hint}</div>
      </div>
    );
  }
  return (
    <Link href={`/organize?m=${k}`} className="org-mode">
      <div className="org-mode-top">
        <span>{label}</span>
        <span className="org-count">{count}</span>
      </div>
      <div className="org-hint">{hint}</div>
    </Link>
  );
}
