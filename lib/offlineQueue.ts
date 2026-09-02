// Client-only queue of writes made while offline, replayed on reconnect.
// localStorage is plenty for one user's handful of pending ops.

export type QueueOp =
  | {
      id: string;
      type: "add";
      title: string;
      dueDate?: string;
      projectId?: string;
      flagged?: boolean;
      recurrence?: unknown;
      ts: number;
    }
  | { id: string; type: "complete"; todoId: string; ts: number };

export type QueueInput =
  | {
      type: "add";
      title: string;
      dueDate?: string;
      projectId?: string;
      flagged?: boolean;
      recurrence?: unknown;
    }
  | { type: "complete"; todoId: string };

const KEY = "haru.queue.v1";
export const QUEUE_EVENT = "haru:queue";

function read(): QueueOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(q: QueueOp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function getQueue(): QueueOp[] {
  return typeof window === "undefined" ? [] : read();
}
export function queueSize(): number {
  return getQueue().length;
}

export function enqueue(op: QueueInput): void {
  const q = read();
  // completing a task that's still only queued (not yet on the server): just drop the add
  if (op.type === "complete") {
    const i = q.findIndex((o) => o.type === "add" && o.id === op.todoId);
    if (i >= 0) {
      q.splice(i, 1);
      write(q);
      return;
    }
  }
  q.push({ ...op, id: crypto.randomUUID(), ts: Date.now() } as QueueOp);
  write(q);
}

export function removeOp(id: string): void {
  write(read().filter((o) => o.id !== id));
}

export function onQueueChange(cb: () => void): () => void {
  window.addEventListener(QUEUE_EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    window.removeEventListener(QUEUE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function offlineCompletedIds(): Set<string> {
  return new Set(
    getQueue()
      .filter((o): o is Extract<QueueOp, { type: "complete" }> => o.type === "complete")
      .map((o) => o.todoId),
  );
}
