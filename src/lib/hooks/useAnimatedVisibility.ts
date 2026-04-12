"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a modal (or any conditionally-rendered element) mounted long
 * enough to play an exit animation before unmounting.
 *
 * Usage:
 *   const { shouldRender, exiting } = useAnimatedVisibility(open);
 *   if (!shouldRender) return null;
 *   return (
 *     <div className={exiting ? "sprout-backdrop-exit" : "sprout-backdrop-enter"}>
 *       <div className={exiting ? "sprout-card-exit" : "sprout-card-enter"}>...</div>
 *     </div>
 *   );
 */
export function useAnimatedVisibility(open: boolean, durationMs = 240) {
  const [shouldRender, setShouldRender] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setExiting(false);
      setShouldRender(true);
      return;
    }

    if (!shouldRender) return;

    setExiting(true);
    const t = window.setTimeout(() => {
      setShouldRender(false);
      setExiting(false);
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [open, shouldRender, durationMs]);

  return { shouldRender, exiting };
}
