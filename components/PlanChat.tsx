"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Turn {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

// The thread lives in sessionStorage: it survives hopping to Today and back,
// and clears itself when the app/tab is closed. No server copy, nothing to expire.
const KEY = "haru.plan";

function loadThread(opening: string): Turn[] {
  const fresh: Turn[] = [{ role: "assistant", content: opening }];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Turn[];
    if (!Array.isArray(saved) || saved.length < 2) return fresh;
    // keep the conversation, but let the briefing reflect right now
    return [fresh[0], ...saved.slice(1)];
  } catch {
    return fresh;
  }
}

export default function PlanChat({ opening }: { opening: string }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(() => [
    { role: "assistant", content: opening },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // restore any in-progress thread on mount
  useEffect(() => {
    setTurns(loadThread(opening));
    setDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the first (briefing) turn current without wiping the conversation
  useEffect(() => {
    setTurns((t) =>
      t.length && t[0].content !== opening
        ? [{ role: "assistant", content: opening }, ...t.slice(1)]
        : t,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  // persist (only once there's a real exchange)
  useEffect(() => {
    try {
      if (turns.length > 1) sessionStorage.setItem(KEY, JSON.stringify(turns));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* private mode / quota — fine, just don't persist */
    }
  }, [turns]);

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

  function clearChat() {
    setTurns([{ role: "assistant", content: opening }]);
    setDraft("");
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {turns.length > 1 && (
        <div className="plan-modebar">
          <button className="plan-clear" onClick={clearChat}>
            Clear chat
          </button>
        </div>
      )}

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
