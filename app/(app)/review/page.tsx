import { requireUser } from "@/lib/auth";
import { getDoneSince, getOpenTodos, getProjects } from "@/lib/data";
import { getTimeZone } from "@/lib/tz.server";
import { todayInTz, tzOffset } from "@/lib/tz";
import Gear from "@/components/Gear";
import Link from "next/link";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function ReviewPage() {
  await requireUser();
  const tz = await getTimeZone();
  const today = todayInTz(tz);

  // this calendar week, Monday-start, in the viewer's timezone
  const dow = new Date(today + "T12:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
  const weekStart = addDaysISO(today, -((dow + 6) % 7));
  const weekEnd = addDaysISO(weekStart, 6);
  const nextStart = addDaysISO(weekStart, 7);
  const nextEnd = addDaysISO(weekStart, 13);
  const weekStartTs = `${weekStart}T00:00:00${tzOffset(tz, new Date())}`;

  const [projects, open, done] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    getDoneSince(weekStartTs),
  ]);
  const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const pname = (id: string | null) => (id ? byId.get(id)?.name ?? "—" : "No project");

  // done, grouped by project
  const doneByProject = new Map<string, number>();
  for (const t of done) {
    const k = t.project_id ?? "";
    doneByProject.set(k, (doneByProject.get(k) ?? 0) + 1);
  }
  const doneGroups = [...doneByProject.entries()].sort((a, b) => b[1] - a[1]);

  // slipped: still open, was due earlier this week (or before) and is now overdue
  const slipped = open
    .filter((t) => t.status === "open" && t.due_date != null && t.due_date < today)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  // next week: open todos due Mon–Sun next week
  const nextWeek = open
    .filter(
      (t) => t.status === "open" && t.due_date != null && t.due_date >= nextStart && t.due_date <= nextEnd,
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  // streaks worth celebrating
  const streaks = open
    .filter((t) => (t.streak ?? 0) >= 2)
    .sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0));

  const range = (s: string, e: string) => {
    const f = (iso: string) =>
      new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${f(s)} – ${f(e)}`;
  };

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Week in review · {range(weekStart, weekEnd)}</div>
        <h1>How the week went</h1>
        <div className="sub">
          {done.length} done · {slipped.length} slipped · {nextWeek.length} lined up next week
        </div>
        <Gear />
      </header>

      <div className="body">
        <div className="group">
          <h2>Done this week · {done.length}</h2>
          {doneGroups.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Nothing marked done yet this week.</p>
          ) : (
            <ul className="list">
              {doneGroups.map(([pid, n]) => (
                <li key={pid || "none"} className="row">
                  <div className="main">
                    <div className="title">{pname(pid || null)}</div>
                    <div className="meta">
                      <span className="chip">{n} done</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {streaks.length > 0 && (
          <div className="group">
            <h2>Kept going</h2>
            <ul className="list">
              {streaks.map((t) => (
                <li key={t.id} className="row">
                  <div className="main">
                    <div className="title">{t.title}</div>
                    <div className="meta">
                      <span className="chip streak">{t.streak}-in-a-row</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="group">
          <h2>Slipped · {slipped.length}</h2>
          {slipped.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Nothing overdue — clean.</p>
          ) : (
            <ul className="list">
              {slipped.map((t) => (
                <li key={t.id} className="row">
                  <div className="main">
                    <div className="title">{t.title}</div>
                    <div className="meta">
                      <span className="chip overdue">due {t.due_date}</span>
                      <span className="chip">{pname(t.project_id)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="group">
          <h2>Next week · {range(nextStart, nextEnd)}</h2>
          {nextWeek.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Nothing dated yet.</p>
          ) : (
            <ul className="list">
              {nextWeek.map((t) => (
                <li key={t.id} className="row">
                  <div className="main">
                    <div className="title">{t.title}</div>
                    <div className="meta">
                      <span className="chip">{t.due_date}</span>
                      <span className="chip">{pname(t.project_id)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link href="/plan" className="cta">
          Talk it through →
        </Link>
      </div>
    </>
  );
}
