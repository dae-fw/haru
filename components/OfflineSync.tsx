"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { addTodo, completeTodo } from "@/app/(app)/actions";
import { getQueue, onQueueChange, removeOp } from "@/lib/offlineQueue";

let flushing = false;

export default function OfflineSync() {
  const router = useRouter();

  useEffect(() => {
    async function flush() {
      if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
      const q = getQueue();
      if (!q.length) return;
      flushing = true;
      let synced = 0;
      try {
        for (const op of q) {
          try {
            if (op.type === "add") {
              const fd = new FormData();
              fd.set("title", op.title);
              if (op.projectId) fd.set("project_id", op.projectId);
              if (op.dueDate) fd.set("due_date", op.dueDate);
              if (op.flagged) fd.set("flagged", "on");
              if (op.recurrence) fd.set("recurrence", JSON.stringify(op.recurrence));
              await addTodo(fd);
            } else {
              await completeTodo(op.todoId);
            }
            removeOp(op.id);
            synced++;
          } catch {
            break; // still offline / server unhappy — keep the rest, retry later
          }
        }
      } finally {
        flushing = false;
      }
      if (synced) router.refresh();
    }

    flush();
    window.addEventListener("online", flush);
    const off = onQueueChange(() => {
      if (navigator.onLine) flush();
    });
    return () => {
      window.removeEventListener("online", flush);
      off();
    };
  }, [router]);

  return null;
}
