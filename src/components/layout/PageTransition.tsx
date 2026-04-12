"use client";

import { usePathname } from "next/navigation";

// Wraps route children in a div keyed by pathname so every navigation
// remounts the wrapper and replays the sprout-page-enter keyframe.
// Zero runtime cost when navigation isn't happening — just a div.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="sprout-page-enter">
      {children}
    </div>
  );
}
