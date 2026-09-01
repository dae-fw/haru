"use client";

import { useRef, useTransition } from "react";
import { addIdea } from "@/app/(app)/actions";

export default function AddIdea() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={formRef}
      className="field"
      action={(fd) => start(async () => {
        await addIdea(fd);
        formRef.current?.reset();
      })}
    >
      <input type="text" name="body" placeholder="Jot a thought…" required />
      <button type="submit" aria-label="Save idea" disabled={pending}>
        ↑
      </button>
    </form>
  );
}
