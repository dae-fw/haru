"use client";

import { useEffect, useState } from "react";
import { onQueueChange, queueSize } from "@/lib/offlineQueue";

export default function OfflineBar() {
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    const net = () => setOffline(!navigator.onLine);
    const q = () => setQueued(queueSize());
    net();
    q();
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    const offQ = onQueueChange(q);
    return () => {
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      offQ();
    };
  }, []);

  if (!offline && queued === 0) return null;

  return (
    <div className="offline-bar" role="status">
      {offline
        ? queued > 0
          ? `Offline — ${queued} change${queued > 1 ? "s" : ""} queued, will sync when you're back.`
          : "Offline — showing your last-loaded data. Changes queue until you're back."
        : `Back online — syncing ${queued} change${queued > 1 ? "s" : ""}…`}
    </div>
  );
}
