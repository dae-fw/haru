import { requireUser } from "@/lib/auth";

export default async function PlanPage() {
  await requireUser();
  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Plan · Haiku 4.5</div>
        <h1>Plan the day together</h1>
        <div className="sub">Coming next</div>
        <a className="gear" href="/settings" aria-label="Settings">⚙</a>
      </header>
      <div className="body">
        <div className="summary">
          The daily planning chat is step 3 of the build. It will read today&apos;s todos and
          calendar events, then talk through priorities and let Haru call
          <code> complete_todo</code>, <code>reschedule_todo</code>, <code>create_event</code> and
          <code> move_event</code>. Calendar integration (step 2) comes first.
        </div>
      </div>
    </>
  );
}
