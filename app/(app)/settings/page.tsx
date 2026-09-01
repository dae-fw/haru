import { requireUser } from "@/lib/auth";
import { getProjects } from "@/lib/data";
import { addProject, setNickname } from "@/app/(app)/actions";
import ThemeControls from "@/components/ThemeControls";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requireUser();
  const projects = await getProjects();

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
      </div>
    </>
  );
}
