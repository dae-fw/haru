"use client";

import { useEffect, useState, useTransition } from "react";
import { addReference, deleteReference, updateReference } from "@/app/(app)/actions";
import {
  biometricSupported,
  disableLock,
  enableLock,
  lockEnabled,
  relock,
  unlock,
  unlockedThisSession,
} from "@/lib/biometric";
import type { Reference } from "@/lib/types";

function Row({ item }: { item: Reference }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label ?? "");
  const [body, setBody] = useState(item.body);
  const [confirmDel, setConfirmDel] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    setRemoving(true);
    setTimeout(() => start(() => deleteReference(item.id)), 340);
  }

  if (!editing) {
    return (
      <div className={`idea${removing ? " removing" : ""}`}>
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
              onClick={remove}
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

  // biometric lock
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [lockErr, setLockErr] = useState<string | null>(null);
  const supported = ready && biometricSupported();

  useEffect(() => {
    setEnabled(lockEnabled());
    setUnlocked(unlockedThisSession());
    setReady(true);
  }, []);

  async function doEnable() {
    setLockErr(null);
    try {
      await enableLock();
      setEnabled(true);
      setUnlocked(true);
    } catch {
      setLockErr("Couldn't set up Face ID here.");
    }
  }
  async function doUnlock() {
    setLockErr(null);
    try {
      if (await unlock()) setUnlocked(true);
      else setLockErr("Didn't unlock.");
    } catch {
      setLockErr("Didn't unlock.");
    }
  }
  function doRelock() {
    relock();
    setUnlocked(false);
  }
  function doDisable() {
    disableLock();
    setEnabled(false);
    setUnlocked(false);
  }

  if (ready && enabled && !unlocked) {
    return (
      <div className="group">
        <h2>Reference</h2>
        <div className="ref-locked">
          <div>🔒 Locked</div>
          <button type="button" className="btn" onClick={doUnlock}>
            Unlock with Face ID
          </button>
          {lockErr && <div className="snap-err">{lockErr}</div>}
        </div>
      </div>
    );
  }

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

      {ready && (
        <div className="ref-lockbar">
          {!enabled && supported && (
            <button type="button" className="linkish" onClick={doEnable}>
              🔒 Lock with Face ID
            </button>
          )}
          {!enabled && ready && !supported && (
            <span style={{ fontSize: "0.76rem", color: "var(--ink-soft)" }}>
              Face ID lock isn&apos;t available on this device.
            </span>
          )}
          {enabled && (
            <>
              <button type="button" className="linkish" onClick={doRelock}>
                Lock now
              </button>
              <button type="button" className="linkish" onClick={doDisable}>
                Turn off lock
              </button>
            </>
          )}
          {lockErr && <span className="snap-err">{lockErr}</span>}
        </div>
      )}
    </div>
  );
}
