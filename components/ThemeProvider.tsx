"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { setAppearance } from "@/app/(app)/actions";

type Palette = "a" | "b" | "c";
type Theme = "light" | "dark" | "system";

interface ThemeState {
  palette: Palette;
  theme: Theme;
  setPalette: (p: Palette) => void;
  setTheme: (t: Theme) => void;
  /** Apply a value read from the account (server) without writing it back. */
  hydrateFromAccount: (p?: Palette, t?: Theme) => void;
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

function persistLocal(palette: Palette, theme: Theme) {
  try {
    localStorage.setItem("haru.palette", palette);
    localStorage.setItem("haru.theme", theme);
  } catch {}
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>("b");
  const [theme, setThemeState] = useState<Theme>("system");
  const hydratedFromAccount = useRef(false);

  // hydrate from localStorage once, for instant paint before the account value is known
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
    persistLocal(p, theme);
    void setAppearance({ palette: p });
  }
  function setTheme(t: Theme) {
    setThemeState(t);
    apply(palette, t);
    persistLocal(palette, t);
    void setAppearance({ theme: t });
  }
  /** Called once with the value stored on the account — wins over the local cache, no write-back. */
  function hydrateFromAccount(p?: Palette, t?: Theme) {
    if (hydratedFromAccount.current) return;
    hydratedFromAccount.current = true;
    const pp = p ?? palette;
    const tt = t ?? theme;
    if (pp === palette && tt === theme) return;
    setPaletteState(pp);
    setThemeState(tt);
    apply(pp, tt);
    persistLocal(pp, tt);
  }

  return (
    <Ctx.Provider value={{ palette, theme, setPalette, setTheme, hydrateFromAccount }}>
      {children}
    </Ctx.Provider>
  );
}
