"use client";

import { usePreferences } from "@/lib/hooks/usePreferences";
import { Badge } from "@/components/ui/Badge";

export function Header() {
  const { preferences } = usePreferences();

  return (
    <header className="flex justify-between items-center px-5 pt-3">
      <h1 className="font-heading text-xl font-800 text-sprout-green-dark">sprout</h1>
      <div className="flex items-center gap-2">
        {preferences.mode === "pro" && <Badge color="green">PRO</Badge>}
        <div className="w-9 h-9 rounded-full bg-white shadow-subtle flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#81C784] to-sprout-green-primary" />
        </div>
      </div>
    </header>
  );
}
