"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Palette = "a" | "b" | "c";
type Theme = "light" | "dark" | "system";

interface ThemeState {
  palette: Palette;
  theme: Theme;
  setPalette: (p: Palette) => void;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeState | null>(null);
export const useTheme = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c;
};

function apply(palette: Palette, theme: Theme) {
  const root = document.documentElement;
  root.dataset.palette = palette;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>("b");
  const [theme, setThemeState] = useState<Theme>("system");

  // hydrate from localStorage once
  useEffect(() => {
    try {
      const p = localStorage.getItem("haru.palette") as Palette | null;
      const t = localStorage.getItem("haru.theme") as Theme | null;
      const pp = p && ["a", "b", "c"].includes(p) ? p : "b";
      const tt = t && ["light", "dark", "system"].includes(t) ? t : "system";
      setPaletteState(pp);
      setThemeState(tt);
      apply(pp, tt);
    } catch {
      apply("b", "system");
    }
  }, []);

  function setPalette(p: Palette) {
    setPaletteState(p);
    apply(p, theme);
    try {
      localStorage.setItem("haru.palette", p);
    } catch {}
  }
  function setTheme(t: Theme) {
    setThemeState(t);
    apply(palette, t);
    try {
      localStorage.setItem("haru.theme", t);
    } catch {}
  }

  return (
    <Ctx.Provider value={{ palette, theme, setPalette, setTheme }}>
      {children}
    </Ctx.Provider>
  );
}
