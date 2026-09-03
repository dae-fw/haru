"use client";

import { useState, useTransition } from "react";
import { addReference, deleteReference, updateReference } from "@/app/(app)/actions";
import type { Reference } from "@/lib/types";

function Row({ item }: { item: Reference }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label ?? "");
  const [body, setBody] = useState(item.body);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="idea">
        {item.label && <div className="i-label">{item.label}</div>}
        <div className="i-body">{item.body}</div>
        <div className="i-meta">
          <button type="button" onClick={() => setEditing(true)}>
            edit
          </button>
          {confirmDel ? (
            <button
              type="button"
              style={{ color: "var(--bad, #c0392b)" }}
              onClick={() => start(() => deleteReference(item.id))}
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

  const field: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--hair)",
    borderRadius: 8,
    padding: "7px 10px",
    background: "var(--surface)",
    fontSize: "0.86rem",
    marginTop: 6,
  };

  return (
    <div className="idea">
      <input
        style={field}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (optional)"
      />
      <textarea
        style={{ ...field, minHeight: 64, resize: "vertical" }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="i-meta">
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              await updateReference(item.id, { label, body });
              setEditing(false);
            })
          }
        >
          {pending ? "…" : "save"}
        </button>
        <button type="button" onClick={() => setEditing(false)}>
          cancel
        </button>
      </div>
    </div>
  );
}

export default function ReferenceList({ items }: { items: Reference[] }) {
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const field: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--hair)",
    borderRadius: 8,
    padding: "8px 11px",
    background: "var(--surface)",
    fontSize: "0.88rem",
  };

  function add() {
    if (!body.trim() || pending) return;
    const fd = new FormData();
    fd.set("label", label);
    fd.set("body", body);
    start(async () => {
      await addReference(fd);
      setLabel("");
      setBody("");
    });
  }

  return (
    <div className="group">
      <h2>
        Reference <span className="count">{items.length}</span>
      </h2>
      <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: 8 }}>
        Facts Haru should just know — rent dates, account numbers, recurring details.
        The chat reads these, and can add to them when you tell it to.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        <input
          style={field}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional) — e.g. Tenant rent"
        />
        <textarea
          style={{ ...field, minHeight: 56, resize: "vertical" }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="The fact itself"
        />
        <div>
          <button
            type="button"
            className="btn"
            disabled={pending || !body.trim()}
            onClick={add}
          >
            {pending ? "Adding…" : "Add reference"}
          </button>
        </div>
      </div>

      <div className="list">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
        {items.length === 0 && (
          <div className="empty">Nothing here yet.</div>
        )}
      </div>
    </div>
  );
}
