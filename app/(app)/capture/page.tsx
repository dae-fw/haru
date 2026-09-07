import { requireUser } from "@/lib/auth";
import { getIdeas, getProjects } from "@/lib/data";
import AddIdea from "@/components/AddIdea";
import SnapNote from "@/components/SnapNote";
import CaptureNotes from "@/components/CaptureNotes";
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
        <CaptureNotes ideas={ideas} />
      </div>
    </>
  );
}
