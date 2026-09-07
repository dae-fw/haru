import { requireUser } from "@/lib/auth";
import { getIdeas, getProjects } from "@/lib/data";
import AddIdea from "@/components/AddIdea";
import SnapNote from "@/components/SnapNote";
import IdeaRow from "@/components/IdeaRow";
import Collapsible from "@/components/Collapsible";
import Gear from "@/components/Gear";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  await requireUser();
  const [ideas, projects] = await Promise.all([getIdeas(), getProjects()]);
  const kept = ideas.filter((i) => i.sorted);
  const thoughts = ideas.filter((i) => !i.sorted);

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

        <Collapsible title="Notes" count={kept.length} defaultOpen>
          {kept.length === 0 ? (
            <div className="empty">Nothing kept yet.</div>
          ) : (
            <div className="list">
              {kept.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} />
              ))}
            </div>
          )}
        </Collapsible>

        <Collapsible
          title="Thoughts"
          count={thoughts.length}
          defaultOpen={thoughts.length > 0}
        >
          <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 8 }}>
            New jots wait here until Organize&apos;s Thoughts pass asks what to do with them.
          </div>
          {thoughts.length === 0 ? (
            <div className="empty">Nothing new to sort.</div>
          ) : (
            <div className="list">
              {thoughts.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} />
              ))}
            </div>
          )}
        </Collapsible>
      </div>
    </>
  );
}
