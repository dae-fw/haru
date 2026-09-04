import { requireUser } from "@/lib/auth";
import { getIdeas, getProjects } from "@/lib/data";
import AddIdea from "@/components/AddIdea";
import SnapNote from "@/components/SnapNote";
import IdeaRow from "@/components/IdeaRow";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  await requireUser();
  const [ideas, projects] = await Promise.all([getIdeas(), getProjects()]);

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Capture</div>
        <h1>Jot it now, sort it later</h1>
        <div className="sub">A quick place for notes and ideas</div>
        <Gear />
      </header>

      <div className="body">
        <AddIdea />
        <SnapNote projects={projects} />

        <div className="group">
          <h2>Notes <span className="count">{ideas.length}</span></h2>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 8 }}>
            These stay here and out of Organize. Promote one to a todo whenever it&apos;s ready.
          </div>
          <div className="list">
            {ideas.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} />
            ))}
            {ideas.length === 0 && (
              <div className="empty">Nothing here yet. Jot something when it comes to you.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
