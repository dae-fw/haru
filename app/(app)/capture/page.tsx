import { requireUser } from "@/lib/auth";
import { getIdeas } from "@/lib/data";
import { deleteIdea, promoteIdea } from "@/app/(app)/actions";
import AddIdea from "@/components/AddIdea";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  await requireUser();
  const ideas = await getIdeas();

  return (
    <>
      <header className="screen-head">
        <div className="eyebrow">Capture</div>
        <h1>Jot it now, sort it later</h1>
        <div className="sub">A quick place for notes and ideas</div>
        <a className="gear" href="/settings" aria-label="Settings">⚙</a>
      </header>

      <div className="body">
        <AddIdea />

        <div className="group">
          <h2>Not sorted yet <span className="count">{ideas.length}</span></h2>
          <div className="list">
            {ideas.map((idea) => (
              <div className="idea" key={idea.id}>
                <div className="i-body">{idea.body}</div>
                <div className="i-meta">
                  <span>
                    {new Date(idea.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <form action={promoteIdea.bind(null, idea.id)}>
                    <button type="submit">make it a todo</button>
                  </form>
                  <form action={deleteIdea.bind(null, idea.id)}>
                    <button type="submit">delete</button>
                  </form>
                </div>
              </div>
            ))}
            {ideas.length === 0 && (
              <div className="empty">Inbox clear. Jot something when it comes to you.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
