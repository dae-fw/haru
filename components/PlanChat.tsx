"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Turn {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

export default function PlanChat({ opening }: { opening: string }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", content: opening },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setDraft("");
    const next: Turn[] = [...turns, { role: "user", content: msg }];
    setTurns(next);
    setBusy(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json()) as { reply: string; actions: string[] };
      setTurns((t) => [
        ...t,
        { role: "assistant", content: data.reply || "…", actions: data.actions },
      ]);
      if (data.actions?.length) router.refresh();
    } catch {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: "Something went wrong reaching the model. Try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {turns.map((t, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div className={`msg ${t.role === "user" ? "me" : "ai"}`}>{t.content}</div>
            {t.actions?.map((a, j) => (
              <div className="msg act" key={`${i}-${j}`}>
                {a}
              </div>
            ))}
          </div>
        ))}
        {busy && <div className="typing">Haru is thinking…</div>}
      </div>

      <form
        className="plan-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What would you like to focus on?"
          disabled={busy}
        />
        <button type="submit" aria-label="Send" disabled={busy || !draft.trim()}>
          ↑
        </button>
      </form>
    </>
  );
}
