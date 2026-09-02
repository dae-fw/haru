import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/data";
import { isGoogleConnected } from "@/lib/google";
import { addProject, disconnectGoogle, setNickname } from "@/app/(app)/actions";
import ThemeControls from "@/components/ThemeControls";
import ConfirmButton from "@/components/ConfirmButton";
import NotificationToggle from "@/components/NotificationToggle";
import { VERSION_LABEL } from "@/lib/version";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const { user } = await requireUser();
  const [projects, gConnected, sp] = await Promise.all([
    getProjects(),
    isGoogleConnected(),
    searchParams,
  ]);

  return (
    <>
      <header className="screen-head">
        <a className="back" href="/">
          ‹ Back
        </a>
        <div className="eyebrow">Settings</div>
        <h1>Settings</h1>
        <div className="sub">{user.email}</div>
      </header>

      <div className="body">
        <div className="settings-block">
          <div className="label">What Haru calls you</div>
          <form action={setNickname}>
            <input
              type="text"
              name="nickname"
              placeholder="Nickname"
              maxLength={40}
              defaultValue={
                (user.user_metadata?.nickname as string | undefined) ?? ""
              }
            />
            <button className="btn" type="submit">
              Save
            </button>
          </form>
          <p style={{ marginTop: 8 }}>
            Used in the greeting on Today. Blank falls back to your username.
          </p>
        </div>

        <ThemeControls />

        <NotificationToggle />

        <div className="settings-block">
          <div className="label">Google Calendar</div>
          {gConnected ? (
            <>
              <p style={{ marginBottom: 8 }}>
                Connected. Today&apos;s events show on the Today screen.
              </p>
              <ConfirmButton
                action={disconnectGoogle}
                label="Disconnect"
                confirmLabel="Disconnect Calendar?"
                className="btn"
              />
            </>
          ) : (
            <>
              <p style={{ marginBottom: 8 }}>
                {sp.gcal === "error"
                  ? "Connection failed — try again."
                  : sp.gcal === "norefresh"
                    ? "Google didn't return a refresh token. Remove Haru at myaccount.google.com/permissions, then reconnect."
                    : "Pull your calendar into the day view and let Plan create / move events."}
              </p>
              <a className="btn primary" href="/connect/google">
                Connect Google Calendar
              </a>
            </>
          )}
        </div>

        <div className="settings-block">
          <div className="label">Projects</div>
          <ul className="list" style={{ marginBottom: 12 }}>
            {projects.map((p) => (
              <li key={p.id} className="row">
                <span
                  className="dot"
                  style={{ background: p.color, width: 12, height: 12, marginTop: 4 }}
                />
                <div className="main">
                  <div className="title">{p.name}</div>
                </div>
              </li>
            ))}
            {projects.length === 0 && (
              <li className="empty" style={{ padding: 12 }}>
                No projects yet.
              </li>
            )}
          </ul>
          <form action={addProject}>
            <input type="text" name="name" placeholder="New project name" required />
            <input type="color" name="color" defaultValue="#2E6E8E" />
            <button className="btn" type="submit">
              Add project
            </button>
          </form>
        </div>

        <div className="settings-block">
          <div className="label">Daily check-ins</div>
          <p>
            Morning nudge and Goodnight recap will land here once notifications are wired
            (build step 6). For now, open <b>Plan</b> when you want to think through the day.
          </p>
        </div>

        <div className="settings-block">
          <div className="label">AI model</div>
          <p>
            Haiku 4.5 for everything — parsing, tagging, summaries, and the planning chat.
            The planning chat can move to Sonnet later if it needs deeper reasoning.
          </p>
        </div>

        <div className="settings-block">
          <div className="label">Account</div>
          <form action="/auth/signout" method="post">
            <button className="btn" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <div className="appfoot">Haru {VERSION_LABEL}</div>
      </div>
    </>
  );
}
