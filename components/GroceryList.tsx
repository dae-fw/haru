"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  addGrocery,
  clearCheckedGroceries,
  deleteGrocery,
  forgetUsual,
  toggleGrocery,
} from "@/app/(app)/actions";
import { GROCERY_ORDER, categorize } from "@/lib/groceryCategories";
import type { Grocery, GroceryUsual } from "@/lib/types";

export default function GroceryList({
  items,
  usuals = [],
}: {
  items: Grocery[];
  usuals?: GroceryUsual[];
}) {
  const [, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [optItems, setOpt] = useOptimistic(
    items,
    (
      state: Grocery[],
      action: { type: "add"; name: string } | { type: "toggle"; id: string },
    ) => {
      if (action.type === "add") {
        return [
          ...state,
          {
            id: `tmp-${action.name}-${state.length}`,
            name: action.name,
            checked: false,
            created_at: new Date().toISOString(),
          },
        ];
      }
      return state.map((g) =>
        g.id === action.id ? { ...g, checked: !g.checked } : g,
      );
    },
  );

  const open = optItems.filter((g) => !g.checked);
  const done = optItems.filter((g) => g.checked);

  const sections = GROCERY_ORDER.map((cat) => ({
    cat,
    items: open.filter((g) => categorize(g.name) === cat),
  })).filter((s) => s.items.length > 0);

  const onList = new Set(open.map((g) => g.name.toLowerCase()));

  function add(name: string) {
    const n = name.trim();
    if (!n || onList.has(n.toLowerCase())) return;
    const fd = new FormData();
    fd.set("name", n);
    start(async () => {
      setOpt({ type: "add", name: n });
      await addGrocery(fd);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    add(text);
    setText("");
  }

  function toggle(g: Grocery) {
    start(async () => {
      setOpt({ type: "toggle", id: g.id });
      await toggleGrocery(g.id, !g.checked);
    });
  }

  return (
    <div>
      <form ref={formRef} className="field" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an item…"
          autoComplete="off"
        />
        <button type="submit" aria-label="Add item" disabled={!text.trim()}>
          +
        </button>
      </form>

      {usuals.length > 0 && (
        <div className="usuals">
          <div className="usuals-lbl">Usuals</div>
          <div className="usuals-chips">
            {usuals.map((u) => (
              <span
                key={u.name}
                className={`usual${onList.has(u.name) ? " on" : ""}`}
              >
                <button
                  type="button"
                  className="usual-add"
                  onClick={() => add(u.name)}
                  disabled={onList.has(u.name)}
                >
                  {u.name} <span className="usual-n">{u.count}</span>
                </button>
                <button
                  type="button"
                  className="usual-x"
                  aria-label={`Forget ${u.name}`}
                  onClick={() => start(() => forgetUsual(u.name))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {optItems.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          List&apos;s empty. Add what you need.
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {sections.map((s) => (
            <div className="group" key={s.cat}>
              <h2>
                {s.cat} <span className="count">{s.items.length}</span>
              </h2>
              <ul className="list">
                {s.items.map((g) => (
                  <li className="row" key={g.id}>
                    <button className="check" aria-label="Check off" onClick={() => toggle(g)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 12l6 6L20 6" />
                      </svg>
                    </button>
                    <div className="main">
                      <div className="title">{g.name}</div>
                    </div>
                    <button
                      className="resched"
                      onClick={() => start(() => deleteGrocery(g.id))}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="now-line anytime" style={{ marginTop: 16 }}>
            <span className="rule" />
            <span className="lbl">in the basket · {done.length}</span>
            <span className="rule" />
          </div>
          <ul className="list">
            {done.map((g) => (
              <li className="row done" key={g.id}>
                <button className="check on" aria-label="Uncheck" onClick={() => toggle(g)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12l6 6L20 6" />
                  </svg>
                </button>
                <div className="main">
                  <div className="title">{g.name}</div>
                </div>
              </li>
            ))}
          </ul>
          <button
            className="linkish"
            style={{ marginTop: 10 }}
            onClick={() => start(() => clearCheckedGroceries())}
          >
            Clear the basket
          </button>
        </>
      )}
    </div>
  );
}
