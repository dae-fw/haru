"use client";

import { useRef, useState, useTransition } from "react";
import { addIdea, addTodo, saveReferenceFields } from "@/app/(app)/actions";
import type { Project } from "@/lib/types";

type Kind = "todo" | "idea" | "reference";

interface Read {
  text: string;
  kind: Kind;
  projectId: string | null;
  projectName: string | null;
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
  const [read, setRead] = useState<Read | null>(null);
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setRead(null);
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
      const r = (await res.json()) as Read;
      setRead(r);
      setText(r.text);
      setProjectId(r.projectId ?? "");
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setReading(false);
    }
  }

  function file(kind: Kind) {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      if (kind === "todo") {
        const fd = new FormData();
        fd.set("title", body);
        if (projectId) fd.set("project_id", projectId);
        await addTodo(fd);
      } else if (kind === "reference") {
        await saveReferenceFields({ body });
      } else {
        const fd = new FormData();
        fd.set("body", body);
        await addIdea(fd);
      }
      setRead(null);
      setText("");
    });
  }

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
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        hidden
      />
      {!read && (
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

      {read && (
        <div className="snap-card">
          <div className="label">Read from the photo — edit if it&apos;s off</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <div className="snap-route">
            <span>File as</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {read.kind === "todo" && read.projectName && (
            <div className="snap-hint">Looks like a task for {read.projectName}.</div>
          )}
          {read.kind === "reference" && (
            <div className="snap-hint">Looks like a detail worth keeping.</div>
          )}
          <div className="snap-actions">
            <button
              className={`btn${read.kind === "idea" ? " primary" : ""}`}
              disabled={saving}
              onClick={() => file("idea")}
            >
              Idea
            </button>
            <button
              className={`btn${read.kind === "todo" ? " primary" : ""}`}
              disabled={saving}
              onClick={() => file("todo")}
            >
              Todo
            </button>
            <button
              className={`btn${read.kind === "reference" ? " primary" : ""}`}
              disabled={saving}
              onClick={() => file("reference")}
            >
              Reference
            </button>
          </div>
          <button className="linkish" onClick={() => setRead(null)}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
