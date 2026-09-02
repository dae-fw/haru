"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type State = "loading" | "unsupported" | "off" | "on" | "blocked";

export default function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !vapid
      ) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, [vapid]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid!),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/push/test", { method: "POST" });
    setMsg(res.ok ? "Sent — check your notifications." : "Test failed.");
    setBusy(false);
  }

  return (
    <div className="settings-block">
      <div className="label">Notifications</div>

      {state === "loading" && <p>Checking…</p>}

      {state === "unsupported" && (
        <p>
          This browser can&apos;t do web push. On iPhone, add Haru to your home screen first.
        </p>
      )}

      {state === "blocked" && (
        <p>
          Notifications are blocked in your browser settings for this site. Re-enable them
          there, then reload.
        </p>
      )}

      {state === "off" && (
        <>
          <p style={{ marginBottom: 8 }}>
            A morning nudge with your ranked day. Off by default.
          </p>
          <button className="btn primary" onClick={enable} disabled={busy}>
            {busy ? "…" : "Turn on"}
          </button>
        </>
      )}

      {state === "on" && (
        <>
          <p style={{ marginBottom: 8 }}>On — you&apos;ll get a morning nudge.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={test} disabled={busy}>
              Send test
            </button>
            <button className="btn" onClick={disable} disabled={busy}>
              Turn off
            </button>
          </div>
        </>
      )}

      {msg && (
        <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--ink-soft)" }}>{msg}</p>
      )}
    </div>
  );
}
