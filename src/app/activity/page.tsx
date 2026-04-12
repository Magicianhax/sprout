"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/Button";
import { PoweredByLifi } from "@/components/ui/PoweredByLifi";
import { RecentActivity } from "@/components/home/RecentActivity";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { useActivity } from "@/lib/hooks/useActivity";

function ActivityContent() {
  const router = useRouter();
  const { user } = usePrivy();
  const { preferences } = usePreferences();
  const address = user?.wallet?.address;
  const { records, loading, error, reload } = useActivity(address);

  // Activity is a pro-mode feature — lite users get bounced back home.
  useEffect(() => {
    if (preferences.mode === "lite") {
      router.replace("/home");
    }
  }, [preferences.mode, router]);

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-28">
      <Header />

      <div className="flex items-end justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-sprout-text-muted">
            History
          </p>
          <p className="font-heading text-2xl font-800 text-sprout-text-primary mt-0.5">
            Activity
          </p>
        </div>
        <Button
          variant="secondary"
          className="!px-4 !py-2 !text-xs shrink-0"
          onClick={reload}
        >
          Refresh
        </Button>
      </div>

      <div className="mt-1">
        <RecentActivity records={records} loading={loading} error={error} />
      </div>

      <p className="mx-5 mt-5 text-[10px] text-sprout-text-muted leading-relaxed">
        Shows transfers routed through LI.FI. Direct vault withdrawals appear
        on the block explorer linked in the withdrawal confirmation.
      </p>

      <PoweredByLifi className="pt-6 pb-5" />
      <BottomNav />
    </main>
  );
}

export default function ActivityPage() {
  return (
    <AuthGuard>
      <ActivityContent />
    </AuthGuard>
  );
}
