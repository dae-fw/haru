"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import {
  addGrocery,
  clearCheckedGroceries,
  deleteGrocery,
  toggleGrocery,
} from "@/app/(app)/actions";
import type { Grocery } from "@/lib/types";

export default function GroceryList({ items }: { items: Grocery[] }) {
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = text.trim();
    if (!name) return;
    setText("");
    const fd = new FormData();
    fd.set("name", name);
    start(async () => {
      setOpt({ type: "add", name });
      await addGrocery(fd);
    });
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

      {optItems.length === 0 ? (
        <div className="empty" style={{ marginTop: 16 }}>
          List&apos;s empty. Add what you need.
        </div>
      ) : (
        <ul className="list" style={{ marginTop: 14 }}>
          {open.map((g) => (
            <li className="row" key={g.id}>
              <button
                className="check"
                aria-label="Check off"
                onClick={() => toggle(g)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12l6 6L20 6" />
                </svg>
              </button>
              <div className="main">
                <div className="title">{g.name}</div>
              </div>
              <button className="resched" onClick={() => start(() => deleteGrocery(g.id))}>
                remove
              </button>
            </li>
          ))}
        </ul>
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
