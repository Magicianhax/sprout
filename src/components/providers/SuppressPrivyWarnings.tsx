"use client";

import { useEffect } from "react";

/**
 * Swallows a specific React dev-mode warning leaking from
 * `@privy-io/react-auth`'s internal `privy-provider-*.mjs` bundle
 * (v2.25.0). The library attaches an `isActive` prop to a plain
 * `<div>`, which React flags with:
 *
 *   "React does not recognize the `isActive` prop on a DOM element."
 *
 * It's harmless — the attribute is dropped at runtime and Privy's
 * auth modal still works — but it pollutes the dev console on
 * every render. We can't patch Privy's compiled output, and the
 * warning is purely a development check (React strips it in
 * production), so we filter *exactly* this message and leave
 * every other warning untouched.
 */
export function SuppressPrivyWarnings() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === "string" && first.includes("`isActive`")) {
        // Privy-provider dev-mode leak — drop it.
        return;
      }
      originalError.apply(console, args as Parameters<typeof console.error>);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}
