"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, PieChart, Settings, Compass, History } from "lucide-react";
import { usePreferences } from "@/lib/hooks/usePreferences";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { preferences } = usePreferences();

  const isPro = preferences.mode === "pro";
  const homeLabel = isPro ? "Explore" : "Home";
  const HomeIcon = isPro ? Compass : Home;

  const tabs = [
    { label: homeLabel, icon: HomeIcon, path: "/home" },
    { label: "Portfolio", icon: PieChart, path: "/portfolio" },
    ...(isPro
      ? [{ label: "Activity", icon: History, path: "/activity" }]
      : []),
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-sprout-border flex py-2.5 pb-5 z-50">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
          >
            <tab.icon
              size={24}
              className={isActive ? "text-sprout-green-primary" : "text-gray-300"}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span
              className={`text-[10px] ${
                isActive
                  ? "text-sprout-green-primary font-bold"
                  : "text-sprout-text-muted"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
