"use client";

import { useEffect } from "react";
import { usePreferences } from "@/lib/hooks/usePreferences";

// Applies the dark-mode class to <html> based on stored preferences.
// Mounted once at the root so every page inherits the theme.
export function ThemeSync() {
  const { preferences } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [preferences.darkMode]);

  return null;
}
