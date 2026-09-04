"use client";

import { useRef, useState, useTransition } from "react";
import { addIdea, addTodo } from "@/app/(app)/actions";
import type { Project } from "@/lib/types";

type Kind = "todo" | "idea";

interface Item {
  text: string;
  kind: Kind;
  projectId: string | null;
  include: boolean;
}

async function downscale(file: File): Promise<{ data: string; mediaType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SnapNote({ projects }: { projects: Project[] }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [dropped, setDropped] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function patch(i: number, p: Partial<Item>) {
    setItems((arr) => arr!.map((it, j) => (j === i ? { ...it, ...p } : it)));
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setItems(null);
    setReading(true);
    try {
      const { data, mediaType } = await downscale(file);
      const res = await fetch("/api/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(
          j.error === "not_configured"
            ? "Reading notes needs the AI key set up."
            : j.error === "empty"
              ? "Couldn't make out any text — try a straight-on, well-lit shot."
              : "Couldn't read that image. Try again or type it in.",
        );
        return;
      }
      const j = (await res.json()) as {
        items: { text: string; kind: Kind; projectId: string | null }[];
        dropped: number;
      };
      setItems(j.items.map((it) => ({ ...it, include: true })));
      setDropped(j.dropped);
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setReading(false);
    }
  }

  function addAll() {
    const chosen = items!.filter((it) => it.include && it.text.trim());
    if (!chosen.length) return;
    start(async () => {
      for (const it of chosen) {
        if (it.kind === "todo") {
          const fd = new FormData();
          fd.set("title", it.text.trim());
          if (it.projectId) fd.set("project_id", it.projectId);
          await addTodo(fd);
        } else {
          const fd = new FormData();
          fd.set("body", it.text.trim());
          await addIdea(fd);
        }
      }
      setItems(null);
    });
  }

  const chosenCount = items?.filter((it) => it.include && it.text.trim()).length ?? 0;

  return (
    <div className="snap">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        hidden
      />
      <input ref={libraryRef} type="file" accept="image/*" onChange={onPick} hidden />

      {!items && (
        <div className="snap-pick">
          <button
            className="snap-btn"
            onClick={() => cameraRef.current?.click()}
            disabled={reading}
          >
            {reading ? "Reading the photo…" : "📷  Take a photo"}
          </button>
          {!reading && (
            <button className="snap-btn ghost" onClick={() => libraryRef.current?.click()}>
              🖼  Choose from library
            </button>
          )}
        </div>
      )}
      {err && <div className="snap-err">{err}</div>}

      {items && (
        <div className="snap-card">
          <div className="label">
            Read {items.length} item{items.length === 1 ? "" : "s"} — untick what you don&apos;t want
            {dropped > 0 && `, ${dropped} more not shown (photograph the rest)`}
          </div>

          <div className="snap-items">
            {items.map((it, i) => (
              <div className={`snap-item${it.include ? "" : " off"}`} key={i}>
                <button
                  className={`subcheck${it.include ? " on" : ""}`}
                  aria-label={it.include ? "Exclude" : "Include"}
                  onClick={() => patch(i, { include: !it.include })}
                />
                <div className="snap-item-main">
                  <input
                    value={it.text}
                    onChange={(e) => patch(i, { text: e.target.value })}
                  />
                  <div className="snap-item-row">
                    <div className="seg tiny">
                      <button
                        className={it.kind === "todo" ? "on" : ""}
                        onClick={() => patch(i, { kind: "todo" })}
                      >
                        Todo
                      </button>
                      <button
                        className={it.kind === "idea" ? "on" : ""}
                        onClick={() => patch(i, { kind: "idea" })}
                      >
                        Idea
                      </button>
                    </div>
                    <select
                      value={it.projectId ?? ""}
                      onChange={(e) => patch(i, { projectId: e.target.value || null })}
                    >
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="snap-actions">
            <button className="btn primary" disabled={saving || !chosenCount} onClick={addAll}>
              {saving ? "Adding…" : `Add ${chosenCount}`}
            </button>
            <button className="linkish" onClick={() => setItems(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
