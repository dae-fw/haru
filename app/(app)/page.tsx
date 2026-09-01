import { requireUser } from "@/lib/auth";
import {
  getDoneToday,
  getOpenTodos,
  getProjects,
  isOnToday,
  isWaiting,
} from "@/lib/data";
import { getTodayEvents, type CalEvent } from "@/lib/google";
import { getTimeZone, hourInTz, timeInTz, todayInTz } from "@/lib/tz";
import { unparkTodo } from "@/app/(app)/actions";
import TodoRow from "@/components/TodoRow";
import PlanLink from "@/components/PlanLink";
import Gear from "@/components/Gear";
import type { Project, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function displayName(meta?: string, email?: string | null): string {
  const trimmed = meta?.trim();
  if (trimmed) return trimmed;
  const local = email?.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function rank(t: Todo, today: string): number {
  if (t.due_date && t.due_date < today) return 0;
  if (t.due_date === today) return 1;
  return 2;
}

function EventRow({ e, past, tz }: { e: CalEvent; past?: boolean; tz: string }) {
  const when = e.allDay ? "all day" : timeInTz(e.start, tz);
  return (
    <li className={`row event${past ? " past" : ""}`}>
      <span className="when">{when}</span>
      <div className="main">
        <div className="title">{e.title}</div>
        <div className="meta">
          <span className="chip">calendar</span>
        </div>
      </div>
    </li>
  );
}

export default async function TodayPage() {
  const { user } = await requireUser();
  const tz = await getTimeZone();
  const [projects, open, doneToday, events] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    getDoneToday(),
    getTodayEvents(tz),
  ]);
  const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const today = todayInTz(tz);
  const now = Date.now();

  const todayList = open
    .filter((t) => isOnToday(t, today))
    .sort(
      (a, b) =>
        rank(a, today) - rank(b, today) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );
  const waitingList = open.filter(isWaiting);
  const overdue = todayList.filter((t) => rank(t, today) === 0);
  const rest = todayList.filter((t) => rank(t, today) !== 0);

  const pastEvents = events
    .filter((e) => !e.allDay && new Date(e.end).getTime() < now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcomingEvents = events
    .filter((e) => e.allDay || new Date(e.end).getTime() >= now)
    .sort((a, b) => (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || a.start.localeCompare(b.start));

  const above = pastEvents.length + overdue.length;
  const below = upcomingEvents.length + rest.length;

  const name = displayName(
    (user.user_metadata?.nickname as string | undefined) ??
      (user.user_metadata?.name as string | undefined),
    user.email,
  );
  const doneCount = doneToday.length;
  const totalToday = todayList.length + doneCount;
  const trulyEmpty =
    todayList.length === 0 &&
    waitingList.length === 0 &&
    doneCount === 0 &&
    events.length === 0;

  const summary = todayList.length
    ? `${overdue.length ? `${overdue.length} overdue, then ` : ""}${rest.length} due today${
        upcomingEvents.length ? `, ${upcomingEvents.length} event${upcomingEvents.length > 1 ? "s" : ""} ahead` : ""
      }.`
    : events.length
      ? `No tasks due — ${events.length} event${events.length > 1 ? "s" : ""} on the calendar.`
      : "A clear list today — nice.";

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">
          {new Date().toLocaleDateString("en-US", {
            timeZone: tz,
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
        <h1>
          {greeting(hourInTz(tz))}, {name}
        </h1>
        <div className="sub">
          {open.length} open · {waitingList.length} waiting · {doneCount} done
        </div>
        <Gear />
      </header>

      <div className="body">
        {!trulyEmpty && (
          <div className="summary">
            {summary}{" "}
            {totalToday > 0 && (
              <span className="prog">
                {doneCount} of {totalToday} done
              </span>
            )}
          </div>
        )}

        {(above > 0 || below > 0) && (
          <ul className="list">
            {pastEvents.map((e) => (
              <EventRow key={e.id} e={e} past tz={tz} />
            ))}
            {overdue.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                project={t.project_id ? byId.get(t.project_id) : undefined}
              />
            ))}
            {above > 0 && below > 0 && (
              <div className="now-line">
                <span className="rule" />
                <span className="lbl">now</span>
                <span className="rule" />
              </div>
            )}
            {upcomingEvents.map((e) => (
              <EventRow key={e.id} e={e} tz={tz} />
            ))}
            {rest.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                project={t.project_id ? byId.get(t.project_id) : undefined}
              />
            ))}
          </ul>
        )}

        {waitingList.length > 0 && (
          <div className="waiting">
            <h2>Waiting on others · {waitingList.length}</h2>
            {waitingList.map((t) => (
              <div key={t.id}>
                <div className="w-title">{t.title}</div>
                <div className="w-meta">
                  {t.waiting_on ? `Waiting on ${t.waiting_on}. ` : ""}
                  {t.wake_at
                    ? `Back on ${new Date(t.wake_at).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}. `
                    : ""}
                  <form
                    action={unparkTodo.bind(null, t.id)}
                    style={{ display: "inline" }}
                  >
                    <button type="submit" className="linkish">
                      It&apos;s here now →
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {doneCount > 0 && (
          <div className="group">
            <h2>
              Done today <span className="count">{doneCount}</span>
            </h2>
            <ul className="list">
              {doneToday.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  showTools={false}
                  project={t.project_id ? byId.get(t.project_id) : undefined}
                />
              ))}
            </ul>
          </div>
        )}

        {trulyEmpty && (
          <div className="empty">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-soft)"
              strokeWidth={1.6}
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <div className="t">Nothing due today</div>
            <div>Add a todo in All, or jot something in Capture.</div>
          </div>
        )}

        <PlanLink />
      </div>
    </>
  );
}
