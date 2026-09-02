"use client";

import { useEffect, useState } from "react";
import { getQueue, onQueueChange, type QueueOp } from "@/lib/offlineQueue";

export default function QueuedTasks() {
  const [ops, setOps] = useState<QueueOp[]>([]);

  useEffect(() => {
    const sync = () => setOps(getQueue().filter((o) => o.type === "add"));
    sync();
    return onQueueChange(sync);
  }, []);

  if (ops.length === 0) return null;

  return (
    <div className="group">
      <h2>
        Queued <span className="count">{ops.length} · will sync</span>
      </h2>
      <ul className="list">
        {ops.map((o) =>
          o.type === "add" ? (
            <li className="row" key={o.id} style={{ opacity: 0.7 }}>
              <span className="check" aria-hidden />
              <div className="main">
                <div className="title">{o.title}</div>
                <div className="meta">
                  <span className="chip">offline · pending</span>
                  {o.recurrence != null && <span className="chip">↻ recurring</span>}
                </div>
              </div>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
