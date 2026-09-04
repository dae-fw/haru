import { requireUser } from "@/lib/auth";
import {
  getDoneToday,
  getOpenTodos,
  getProjects,
  isOnToday,
  isWaiting,
} from "@/lib/data";
import { getTodayEvents, getTomorrowEvents, isGoogleConnected } from "@/lib/google";
import { hourInTz, todayInTz } from "@/lib/tz";
import { projectsWithEventToday } from "@/lib/plan";
import { getTimeZone } from "@/lib/tz.server";
import { unparkTodo } from "@/app/(app)/actions";
import TodoRow from "@/components/TodoRow";
import EventRow from "@/components/EventRow";
import QuickAddTodo from "@/components/QuickAddTodo";
import QueuedTasks from "@/components/QueuedTasks";
import EarlierToday from "@/components/EarlierToday";
import Horizon from "@/components/Horizon";
import AddEventButton from "@/components/AddEventButton";
import Gear from "@/components/Gear";
import type { Project, Todo } from "@/lib/types";

export const dynamic = "force-dynamic";

function greeting(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Haru (the cat) talking. Rotates a few times through the day.
const HARU_DAY = [
  "Did you feed me yet? I genuinely can't remember.",
  "Chin scratches. Now would be good.",
  "The sunny spot is taken. By me. Fresh water though?",
  "I knocked something off the table earlier. You're welcome.",
  "Pet me for exactly eight seconds. I'll say when to stop.",
  "I'm not hungry… okay maybe a little.",
  "Play with me? The string one. You know the one.",
  "Been guarding the window all morning. It's exhausting.",
  "You were gone forty whole seconds. Never again.",
  "Brush me. I'm shedding on the good chair on purpose.",
  "Refill the water bowl or I drink from your glass. Your call.",
  "One (1) treat and I'll leave your keyboard alone.",
];
const HARU_NIGHT = [
  "Goodnight kiss? On the head, not the nose.",
  "Come to bed. I saved you a spot — it's the middle.",
  "One more chin scratch and I'll let you sleep. Maybe.",
  "Did you lock the door? Also: treats.",
  "Fair warning: zoomies at 3am. Sleep well.",
  "Cuddle me. Body heat is a shared resource.",
  "Top up my water before bed. Judging you all night is thirsty work.",
  "Tuck me in. I'll move the second you're done.",
  "I'll be a loaf on your legs shortly. Don't move.",
];
function haruSays(h: number, tz: string): string {
  const list = h >= 6 && h < 20 ? HARU_DAY : HARU_NIGHT;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const daySeed = day.split("-").reduce((a, n) => a + Number(n), 0);
  const seed = daySeed * 5 + Math.floor(h / 6); // shifts every 6 hours
  return list[seed % list.length];
}

function displayName(meta?: string, email?: string | null): string {
  const trimmed = meta?.trim();
  if (trimmed) return trimmed;
  const local = email?.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function rank(t: Todo, today: string, eventProjects?: Set<string>): number {
  if (t.due_date && t.due_date < today) return 0;
  if (t.due_date === today) return 1;
  if (t.project_id && eventProjects?.has(t.project_id)) return 2; // project has an event today
  return 3;
}


export default async function TodayPage() {
  const { user } = await requireUser();
  const tz = await getTimeZone();
  const [projects, open, doneToday, events, tomorrowEvents, connected] = await Promise.all([
    getProjects(),
    getOpenTodos(),
    getDoneToday(),
    getTodayEvents(tz),
    getTomorrowEvents(tz),
    isGoogleConnected(),
  ]);
  const byId = new Map<string, Project>(projects.map((p) => [p.id, p]));
  const today = todayInTz(tz);
  const now = Date.now();
  const nowISO = new Date().toISOString();

  // Brief priority rule #3: a task whose project has a calendar event today.
  const eventProjects = projectsWithEventToday(events, projects);

  const todayList = open
    .filter(
      (t) =>
        isOnToday(t, today) ||
        (t.status === "open" &&
          !!t.project_id &&
          eventProjects.has(t.project_id) &&
          !(t.snooze_until && t.snooze_until > nowISO)),
    )
    .sort(
      (a, b) =>
        rank(a, today, eventProjects) - rank(b, today, eventProjects) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );
  const waitingList = open.filter(isWaiting);
  const overdue = todayList.filter((t) => rank(t, today, eventProjects) === 0);
  const rest = todayList.filter((t) => rank(t, today, eventProjects) !== 0);

  // "Coming up" horizon: dated todos beyond today that aren't already on the list.
  const onTodayIds = new Set(todayList.map((t) => t.id));
  const tmrDate = new Date(today + "T00:00:00Z");
  tmrDate.setUTCDate(tmrDate.getUTCDate() + 1);
  const tomorrowISO = tmrDate.toISOString().slice(0, 10);
  const weekEnd = new Date(today + "T00:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const weekEndISO = weekEnd.toISOString().slice(0, 10);
  const [yr, mo] = today.split("-").map(Number);
  const monthEndISO = new Date(Date.UTC(yr, mo, 0)).toISOString().slice(0, 10);
  const sortByDue = (a: Todo, b: Todo) =>
    (Number(b.flagged) - Number(a.flagged)) ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  const tomorrowAhead = open
    .filter(
      (t) =>
        !onTodayIds.has(t.id) &&
        t.status === "open" &&
        t.due_date === tomorrowISO,
    )
    .sort(sortByDue);
  const weekAhead = open
    .filter(
      (t) =>
        !onTodayIds.has(t.id) &&
        t.status === "open" &&
        t.due_date != null &&
        t.due_date > tomorrowISO &&
        t.due_date <= weekEndISO,
    )
    .sort(sortByDue);
  const monthAhead = open
    .filter(
      (t) =>
        !onTodayIds.has(t.id) &&
        t.status === "open" &&
        t.due_date != null &&
        t.due_date > weekEndISO &&
        t.due_date <= monthEndISO,
    )
    .sort(sortByDue);

  // ---- merged timeline: timed tasks + calendar events, in one clock stream ----
  const hm = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  const nowHM = hm(new Date());

  const pastEvents = events
    .filter((e) => !e.allDay && new Date(e.end).getTime() < now)
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcomingEvents = events.filter(
    (e) => e.allDay || new Date(e.end).getTime() >= now,
  );

  const timed = rest.filter((t) => t.due_time);
  const untimed = rest.filter((t) => !t.due_time);
  const lateTimed = timed
    .filter((t) => t.due_time! < nowHM)
    .sort((a, b) => a.due_time!.localeCompare(b.due_time!));
  const upcomingTimed = timed.filter((t) => t.due_time! >= nowHM);

  type Slot = { at: string; ev?: (typeof events)[number]; todo?: Todo };
  const stream: Slot[] = [
    ...upcomingEvents.map(
      (e): Slot => ({ at: e.allDay ? "00:00" : hm(new Date(e.start)), ev: e }),
    ),
    ...upcomingTimed.map((t): Slot => ({ at: t.due_time!, todo: t })),
  ].sort((a, b) => a.at.localeCompare(b.at) || (a.ev && !b.ev ? -1 : b.ev ? 1 : 0));

  // past events + tasks done today collapse into <EarlierToday>; overdue stays visible.
  const above = overdue.length + lateTimed.length;
  const below = stream.length + untimed.length;

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
        <div className="cat-nudge">{haruSays(hourInTz(tz), tz)}</div>
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

        <QuickAddTodo projects={projects} />
        {connected && <AddEventButton />}
        <QueuedTasks />

        <EarlierToday events={pastEvents} done={doneToday} projects={projects} tz={tz} />

        {(above > 0 || below > 0) && (
          <ul className="list">
            {overdue.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                projects={projects}
                project={t.project_id ? byId.get(t.project_id) : undefined}
              />
            ))}
            {lateTimed.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                projects={projects}
                project={t.project_id ? byId.get(t.project_id) : undefined}
                hint="late"
              />
            ))}
            {above > 0 && below > 0 && (
              <div className="now-line">
                <span className="rule" />
                <span className="lbl">now</span>
                <span className="rule" />
              </div>
            )}
            {stream.map((s) =>
              s.ev ? (
                <EventRow key={s.ev.id} event={s.ev} tz={tz} />
              ) : (
                <TodoRow
                  key={s.todo!.id}
                  todo={s.todo!}
                  projects={projects}
                  project={s.todo!.project_id ? byId.get(s.todo!.project_id) : undefined}
                  hint={
                    rank(s.todo!, today, eventProjects) === 2 ? "meeting today" : undefined
                  }
                />
              ),
            )}
            {untimed.length > 0 && (
              <div className="now-line anytime">
                <span className="rule" />
                <span className="lbl">anytime</span>
                <span className="rule" />
              </div>
            )}
            {untimed.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                projects={projects}
                project={t.project_id ? byId.get(t.project_id) : undefined}
                hint={
                  rank(t, today, eventProjects) === 2 ? "meeting today" : undefined
                }
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

        <Horizon
          tomorrow={tomorrowAhead}
          tomorrowEvents={tomorrowEvents}
          week={weekAhead}
          month={monthAhead}
          projects={projects}
          tz={tz}
        />

        <a href="/review" className="cta">
          Week in review →
        </a>
      </div>
    </>
  );
}
