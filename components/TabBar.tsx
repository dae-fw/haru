"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  "/": <path d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5M9.5 20v-5.5h5V20" />,
  "/all": <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  "/plan": (
    <path d="M21 11.5a8.4 8.4 0 0 1-11.6 7.7L3 21l1.8-6.4A8.5 8.5 0 1 1 21 11.5z" />
  ),
  "/capture": <path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5zM13.5 6.5l4 4" />,
};

const tabs = [
  { href: "/", label: "Today" },
  { href: "/all", label: "All" },
  { href: "/plan", label: "Plan" },
  { href: "/capture", label: "Capture" },
];

export default function TabBar({
  overdue = 0,
  todayCount = 0,
}: {
  overdue?: number;
  todayCount?: number;
}) {
  const path = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  // clear the optimistic highlight once the route actually changes
  useEffect(() => setPending(null), [path]);

  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const isActive = t.href === "/" ? path === "/" : path.startsWith(t.href);
        const active = pending ? pending === t.href : isActive;
        const badge =
          t.href === "/" && overdue > 0
            ? overdue
            : t.href === "/all" && todayCount > 0
              ? todayCount
              : null;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch
            onClick={() => {
              if (isActive) return;
              setPending(t.href);
              setSel(t.href);
              setTimeout(() => setSel((s) => (s === t.href ? null : s)), 450);
            }}
            className={`${active ? "active" : ""}${sel === t.href ? " sel" : ""}`}
          >
            <span className="iconwrap">
              <svg
                className="tabicon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[t.href]}
              </svg>
            </span>
            <span className="tablabel">{t.label}</span>
            {badge != null && <span className="tbadge">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
