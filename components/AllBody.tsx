"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bulkComplete,
  bulkDelete,
  bulkReopen,
  bulkReschedule,
  bulkSetProject,
  unparkTodo,
} from "@/app/(app)/actions";
import { todayISO } from "@/lib/recurrence";
import { thisWeekDate, addDays } from "@/lib/organize";
import {
  PREDS,
  dateBuckets,
  flatSorted,
  plusDaysISO,
  type FilterKey,
} from "@/lib/allview";
import QuickAddTodo from "@/components/QuickAddTodo";
import TodoRow from "@/components/TodoRow";
import AllFilters from "@/components/AllFilters";
import DoneToday from "@/components/DoneToday";
import type { Project, Todo } from "@/lib/types";

export default function AllBody({
  active,
  waiting,
  doneToday,
  projects,
  counts,
}: {
  active: Todo[];
  waiting: Todo[];
  doneToday: Todo[];
  projects: Project[];
  counts: Record<string, number>;
}) {
  const sp = useSearchParams();
  const fParam = sp.get("f") ?? "all";
  const filter: FilterKey = (PREDS as Record<string, unknown>)[fParam]
    ? (fParam as FilterKey)
    : "all";

  const router = useRouter();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const [selectMode, setSelectMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [projPick, setProjPick] = useState(false);
  const [dtPick, setDtPick] = useState(false);
  const [undo, setUndo] = useState<string[] | null>(null);

  const toggleSel = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const clearSel = () => {
    setSel(new Set());
    setSelectMode(false);
    setProjPick(false);
    setDtPick(false);
  };
  const ids = () => [...sel];
  const after = () => {
    clearSel();
    router.refresh();
  };
  const doReschedule = (date: string) =>
    bulkReschedule(ids(), date).then(after);
  const doComplete = () => {
    const list = ids();
    bulkComplete(list).then(() => {
      setUndo(list);
      setTimeout(() => setUndo((u) => (u === list ? null : u)), 5000);
      after();
    });
  };

  const byId = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );
  const today = todayISO();
  const wk = plusDaysISO(7);

  const matchQ = (t: Todo) => {
    if (!query) return true;
    const proj = t.project_id ? byId.get(t.project_id)?.name ?? "" : "";
    return (
      t.title.toLowerCase().includes(query) ||
      (t.notes ?? "").toLowerCase().includes(query) ||
      proj.toLowerCase().includes(query)
    );
  };

  const visible = active.filter((t) => PREDS[filter](t, today, wk) && matchQ(t));
  const searching = query.length > 0;

  const groups =
    filter === "all" && !searching
      ? dateBuckets(visible, today)
      : [{ key: "flat", title: "", items: flatSorted(visible) }];

  const row = (t: Todo) => (
    <TodoRow
      key={t.id}
      todo={t}
      projects={projects}
      project={t.project_id ? byId.get(t.project_id) : undefined}
      showTools={!selectMode}
      selectable={selectMode}
      selected={sel.has(t.id)}
      onToggleSelect={() => toggleSel(t.id)}
    />
  );

  return (
    <div className="body">
      <QuickAddTodo projects={projects} dueToday={false} />

      <div className="all-tools">
        <input
          className="all-search"
          type="search"
          placeholder="Search todos…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="linkish"
          onClick={() => (selectMode ? clearSel() : setSelectMode(true))}
        >
          {selectMode ? "Cancel" : "Select"}
        </button>
      </div>

      <AllFilters counts={counts} />

      {groups.length === 0 || groups.every((g) => g.items.length === 0) ? (
        <div className="empty">
          {searching
            ? "Nothing matches."
            : filter === "all"
              ? "No open todos. Add one above."
              : "Nothing in this filter."}
        </div>
      ) : groups[0].key === "flat" ? (
        <ul className="list">{groups[0].items.map(row)}</ul>
      ) : (
        groups.map((g) => (
          <div className="group" key={g.key}>
            <h2>
              {g.title} <span className="count">{g.items.length}</span>
            </h2>
            <ul className="list">{g.items.map(row)}</ul>
          </div>
        ))
      )}

      {filter === "all" && !searching && waiting.length > 0 && (
        <div className="waiting">
          <h2>Waiting on others · {waiting.length}</h2>
          {waiting.map((t) => (
            <div key={t.id}>
              <div className="w-title">{t.title}</div>
              <div className="w-meta">
                {t.waiting_on ? `Waiting on ${t.waiting_on}. ` : ""}
                {t.wake_at
                  ? `Back on ${new Date(t.wake_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}. `
                  : ""}
                <form action={unparkTodo.bind(null, t.id)} style={{ display: "inline" }}>
                  <button type="submit" className="linkish">
                    It&apos;s here now →
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {filter === "all" && !searching && (
        <DoneToday done={doneToday} projects={projects} />
      )}

      {selectMode && sel.size > 0 && (
        <div className="bulkbar">
          {projPick ? (
            <div className="bulk-pick">
              <button className="chip" onClick={() => bulkSetProject(ids(), null).then(after)}>
                No project
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  className="chip"
                  onClick={() => bulkSetProject(ids(), p.id).then(after)}
                >
                  <span className="dot" style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
              <button className="linkish" onClick={() => setProjPick(false)}>
                back
              </button>
            </div>
          ) : dtPick ? (
            <div className="bulk-pick">
              <button className="chip" onClick={() => doReschedule(today)}>Today</button>
              <button className="chip" onClick={() => doReschedule(addDays(today, 1))}>
                Tomorrow
              </button>
              <button className="chip" onClick={() => doReschedule(thisWeekDate(today))}>
                This week
              </button>
              <label className="chip">
                Date
                <input
                  type="date"
                  onChange={(e) => e.target.value && doReschedule(e.target.value)}
                  style={{ marginLeft: 6 }}
                />
              </label>
              <button className="linkish" onClick={() => setDtPick(false)}>
                back
              </button>
            </div>
          ) : (
            <>
              <span className="bulk-n">{sel.size} selected</span>
              <button className="chip" onClick={() => setDtPick(true)}>Reschedule</button>
              <button className="chip" onClick={doComplete}>Complete</button>
              <button className="chip" onClick={() => setProjPick(true)}>Project</button>
              <button
                className="chip danger"
                onClick={() => bulkDelete(ids()).then(after)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {undo && (
        <div className="bulkbar undo-toast">
          <span>Completed {undo.length}</span>
          <button
            className="linkish"
            onClick={() => {
              const list = undo;
              setUndo(null);
              bulkReopen(list).then(() => router.refresh());
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
