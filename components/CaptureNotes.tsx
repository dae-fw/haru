"use client";

import { useState } from "react";
import IdeaRow from "@/components/IdeaRow";
import Collapsible from "@/components/Collapsible";
import type { Idea } from "@/lib/types";

export default function CaptureNotes({ ideas }: { ideas: Idea[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const match = (i: Idea) => !query || i.body.toLowerCase().includes(query);

  const thoughts = ideas.filter((i) => !i.sorted && match(i));
  const kept = ideas.filter((i) => i.sorted && match(i));
  const searching = query.length > 0;

  return (
    <>
      <input
        className="all-search"
        type="search"
        placeholder="Search notes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <Collapsible
        title="Thoughts"
        count={thoughts.length}
        defaultOpen={thoughts.length > 0 || searching}
      >
        <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: 8 }}>
          New jots wait here until Organize&apos;s Thoughts pass asks what to do with them.
        </div>
        {thoughts.length === 0 ? (
          <div className="empty">{searching ? "No match." : "Nothing new to sort."}</div>
        ) : (
          <div className="list">
            {thoughts.map((i) => (
              <IdeaRow key={i.id} idea={i} />
            ))}
          </div>
        )}
      </Collapsible>

      <Collapsible title="Notes" count={kept.length} defaultOpen={!searching || kept.length > 0}>
        {kept.length === 0 ? (
          <div className="empty">{searching ? "No match." : "Nothing kept yet."}</div>
        ) : (
          <div className="list">
            {kept.map((i) => (
              <IdeaRow key={i.id} idea={i} />
            ))}
          </div>
        )}
      </Collapsible>
    </>
  );
}
