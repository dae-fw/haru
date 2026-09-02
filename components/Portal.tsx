"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body>, escaping the app's scroll container.
 * Bottom sheets must not live inside .body — iOS Safari traps position:fixed
 * inside a scrolling ancestor, which makes a sheet render as a detached box
 * that won't scroll.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
