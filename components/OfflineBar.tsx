"use client";

import { useEffect, useState } from "react";

export default function OfflineBar() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-bar" role="status">
      Offline — showing your last-loaded data. Changes won&apos;t save until you&apos;re back.
    </div>
  );
}
