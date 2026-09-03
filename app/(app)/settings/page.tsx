import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/data";
import { isGoogleConnected } from "@/lib/google";
import { addProject, disconnectGoogle, setNickname } from "@/app/(app)/actions";
import ThemeControls from "@/components/ThemeControls";
import ConfirmButton from "@/components/ConfirmButton";
import NotificationToggle from "@/components/NotificationToggle";
import ProjectRow from "@/components/ProjectRow";
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
          <div className="label">Google</div>
          {gConnected ? (
            <>
              <p style={{ marginBottom: 8 }}>
                Connected. Calendar events show on Today, and new Google Tasks import
                automatically (completing one here marks it done in Google — never deleted).
              </p>
              <p style={{ marginBottom: 8, fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                If Tasks aren&apos;t syncing, reconnect once to grant the Tasks permission.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <a className="btn" href="/connect/google">
                  Reconnect
                </a>
                <ConfirmButton
                  action={disconnectGoogle}
                  label="Disconnect"
                  confirmLabel="Disconnect Google?"
                  className="btn"
                />
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 8 }}>
                {sp.gcal === "error"
                  ? "Connection failed — try again."
                  : sp.gcal === "norefresh"
                    ? "Google didn't return a refresh token. Remove Haru at myaccount.google.com/permissions, then reconnect."
                    : "Calendar on Today, Google Tasks imported automatically, and Plan can create / move events."}
              </p>
              <a className="btn primary" href="/connect/google">
                Connect Google
              </a>
            </>
          )}
        </div>

        <div className="settings-block">
          <div className="label">Projects</div>
          <ul className="list" style={{ marginBottom: 12 }}>
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} />
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
            A morning nudge (top of your day) and a Goodnight recap (what got done, what&apos;s
            on for tomorrow) arrive as push notifications once you turn them on above.
            You can always open <b>Plan</b> to think a day through.
          </p>
        </div>

        <div className="settings-block">
          <div className="label">AI model</div>
          <p>
            Haiku 4.5 powers the planning chat and reading a photo in Capture. Quick-add
            parsing, the daily nudges and the recap are plain on-device logic — no model,
            no cost. The chat can move to Sonnet later if it ever needs deeper reasoning.
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
