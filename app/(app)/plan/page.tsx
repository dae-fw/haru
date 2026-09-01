import { requireUser } from "@/lib/auth";
import Gear from "@/components/Gear";

export default async function PlanPage() {
  await requireUser();
  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Plan · Haiku 4.5</div>
        <h1>Plan the day together</h1>
        <div className="sub">Coming in build step 3</div>
        <Gear />
      </header>
      <div className="body">
        <div className="seg">
          <button className="on">Plan the day</button>
          <button>Goodnight recap</button>
        </div>

        <div className="msg ai">
          Good morning. Once this is wired up I&apos;ll read today&apos;s todos and calendar
          events, surface what to start with, and be able to complete, reschedule, and
          move things for you as we talk.
        </div>
        <div className="qr">
          <span>What&apos;s most urgent?</span>
          <span>Move my overdue items</span>
          <span>Plan around my 2pm</span>
        </div>

        <div className="summary">
          Needs the Anthropic API (step 3) and Google Calendar (step 2). The tools it will
          call — <code>complete_todo</code>, <code>reschedule_todo</code>,{" "}
          <code>create_event</code>, <code>move_event</code> — map to the same actions the
          app already uses.
        </div>
      </div>
    </>
  );
}
