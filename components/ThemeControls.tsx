"use client";

import { useTheme } from "@/components/ThemeProvider";

const PALETTES = [
  { id: "a", name: "Ink & Clay", sw: ["#B4552D", "#4F7A5B", "#F6F4F0"], hex: "#B4552D" },
  { id: "b", name: "Slate & Sky", sw: ["#2E6E8E", "#3E7D63", "#F2F4F5"], hex: "#2E6E8E" },
  { id: "c", name: "Sage & Plum", sw: ["#6C5B8E", "#5B8A6B", "#F4F5F1"], hex: "#6C5B8E" },
] as const;

export default function ThemeControls() {
  const { palette, theme, setPalette, setTheme } = useTheme();

  return (
    <div className="settings-block">
      <div className="label">Appearance</div>

      {PALETTES.map((p) => (
        <button
          key={p.id}
          className={`pal-opt${palette === p.id ? " on" : ""}`}
          onClick={() => setPalette(p.id)}
        >
          <span className="pal-sw">
            {p.sw.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
          <span className="pal-name">
            {p.name} <span className="pal-hex">{p.hex}</span>
          </span>
          {palette === p.id && <span aria-hidden>✓</span>}
        </button>
      ))}

      <div className="seg" style={{ marginTop: 10 }}>
        {(["light", "dark", "system"] as const).map((t) => (
          <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
