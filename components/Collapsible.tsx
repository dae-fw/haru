"use client";

import { useState } from "react";

export default function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [pop, setPop] = useState(false);

  function toggle() {
    setOpen((o) => {
      if (!o) {
        setPop(true);
        setTimeout(() => setPop(false), 460);
      }
      return !o;
    });
  }

  return (
    <div className="earlier-block">
      <button className="earlier" aria-expanded={open} onClick={toggle}>
        <span>{title}</span>
        {count != null && <span className="cnt">· {count}</span>}
        <span className="chev" aria-hidden>
          ▾
        </span>
      </button>
      <div className={`earlier-wrap${open ? " open" : ""}${pop ? " pop" : ""}`}>
        <div className="earlier-inner">
          <div className="earlier-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
