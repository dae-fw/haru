"use client";

import { useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";

/** Applies the palette/theme saved on the account, so it follows you to any device. */
export default function ThemeSync({
  palette,
  theme,
}: {
  palette?: "a" | "b" | "c";
  theme?: "light" | "dark" | "system";
}) {
  const { hydrateFromAccount } = useTheme();
  useEffect(() => {
    hydrateFromAccount(palette, theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
