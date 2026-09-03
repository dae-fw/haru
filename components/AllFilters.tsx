"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "nodate", label: "No date" },
  { key: "flagged", label: "Flagged" },
];

export default function AllFilters({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  const current = useSearchParams().get("f") || "all";

  return (
    <div className="all-filters">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === "all" ? path : `${path}?f=${f.key}`}
          className={`all-filter${current === f.key ? " on" : ""}`}
          scroll={false}
        >
          {f.label}
          {counts[f.key] ? <span className="fc">{counts[f.key]}</span> : null}
        </Link>
      ))}
    </div>
  );
}
