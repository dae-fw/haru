"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
        const badge =
          t.href === "/" && overdue > 0
            ? overdue
            : t.href === "/all" && todayCount > 0
              ? todayCount
              : null;
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            {t.label}
            {badge != null && <span className="tbadge">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
