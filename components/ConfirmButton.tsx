"use client";

import { useState, useTransition } from "react";

export default function ConfirmButton({
  action,
  label,
  confirmLabel = "Delete?",
  className = "linkish",
}: {
  action: () => Promise<void>;
  label: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();

  if (!armed) {
    return (
      <button type="button" className={className} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <span style={{ color: "var(--ink-soft)", fontSize: "0.74rem" }}>{confirmLabel}</span>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => start(() => action())}
      >
        {pending ? "…" : "Yes"}
      </button>
      <button type="button" className={className} onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}
