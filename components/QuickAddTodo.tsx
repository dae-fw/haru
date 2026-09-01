"use client";

import { useRef, useTransition } from "react";
import { addTodo } from "@/app/(app)/actions";

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function QuickAddTodo({
  placeholder = "Add a task for today…",
  dueToday = true,
}: {
  placeholder?: string;
  dueToday?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="field"
      action={(fd) =>
        start(async () => {
          if (dueToday && !fd.get("due_date")) fd.set("due_date", todayLocalISO());
          await addTodo(fd);
          formRef.current?.reset();
        })
      }
    >
      <input type="text" name="title" placeholder={placeholder} required autoComplete="off" />
      <button type="submit" aria-label="Add task" disabled={pending}>
        +
      </button>
    </form>
  );
}
