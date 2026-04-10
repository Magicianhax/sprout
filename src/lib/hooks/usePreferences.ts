"use client";

import { useState, useCallback, useEffect } from "react";
import type { UserPreferences } from "@/lib/types";
import { loadPreferences, updatePreferences as updateStore } from "@/stores/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/constants";

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  const update = useCallback((partial: Partial<UserPreferences>) => {
    const updated = updateStore(partial);
    setPreferences(updated);
    return updated;
  }, []);

  return { preferences, update };
}
