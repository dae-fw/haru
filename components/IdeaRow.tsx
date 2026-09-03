"use client";

import { useState, useTransition } from "react";
import { deleteIdea, promoteIdea, updateIdea } from "@/app/(app)/actions";
import type { Idea } from "@/lib/types";

export default function IdeaRow({ idea }: { idea: Idea }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(idea.body);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  const when = new Date(idea.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (editing) {
    return (
      <div className="idea">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          autoFocus
          style={{
            width: "100%",
            border: "1px solid var(--hair)",
            borderRadius: 8,
            padding: "8px 10px",
            background: "var(--surface)",
            fontSize: "0.9rem",
            resize: "vertical",
          }}
        />
        <div className="i-meta">
          <button
            type="button"
            disabled={pending || !body.trim()}
            onClick={() =>
              start(async () => {
                await updateIdea(idea.id, body);
                setEditing(false);
              })
            }
          >
            {pending ? "…" : "save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setBody(idea.body);
              setEditing(false);
            }}
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="idea">
      <div className="i-body">{idea.body}</div>
      <div className="i-meta">
        <span>{when}</span>
        <button type="button" onClick={() => setEditing(true)}>
          edit
        </button>
        <button type="button" onClick={() => start(() => promoteIdea(idea.id))}>
          make it a todo
        </button>
        {confirmDel ? (
          <button
            type="button"
            style={{ color: "var(--bad, #c0392b)" }}
            onClick={() => start(() => deleteIdea(idea.id))}
          >
            really?
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmDel(true)}>
            delete
          </button>
        )}
      </div>
    </div>
  );
}
