"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserPreferences } from "@/lib/types";
import { loadPreferences, updatePreferences as updateStore } from "@/stores/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/constants";

// Module-level shared state + pub-sub so every component that calls
// usePreferences() sees updates from any other caller (e.g. Settings
// flipping dark mode should immediately re-run ThemeSync).
let current: UserPreferences = DEFAULT_PREFERENCES;
let hydrated = false;
const listeners = new Set<(prefs: UserPreferences) => void>();

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  current = loadPreferences();
  hydrated = true;
}

function notify() {
  for (const listener of listeners) listener(current);
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    hydrateOnce();
    return current;
  });

  useEffect(() => {
    // Make sure we're in sync with the hydrated module state
    hydrateOnce();
    if (preferences !== current) setPreferences(current);

    listeners.add(setPreferences);
    return () => {
      listeners.delete(setPreferences);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((partial: Partial<UserPreferences>) => {
    current = updateStore(partial);
    notify();
    return current;
  }, []);

  return { preferences, update };
}
