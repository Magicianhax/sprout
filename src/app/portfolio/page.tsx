"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { PositionCard } from "@/components/portfolio/PositionCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { usePositions } from "@/lib/hooks/usePositions";
import { formatCurrency } from "@/lib/format";

function PortfolioContent() {
  const router = useRouter();
  const { user } = usePrivy();
  const { preferences } = usePreferences();
  const address = user?.wallet?.address;
  const { positions, loading, error, reload, totalBalance } = usePositions(address);

  const isPro = preferences.mode === "pro";
  const hasPositions = positions.length > 0;

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-28">
      <Header />

      {/* Earnings header */}
      <div className="px-5 pt-5 pb-4">
        <p className="font-heading text-2xl font-800 text-sprout-text-primary">
          Portfolio
        </p>
        {hasPositions && !loading && (
          <p className="text-sm text-sprout-text-muted mt-1">
            <span className="font-semibold text-sprout-green-dark">
              {formatCurrency(totalBalance)}
            </span>{" "}
            total balance
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 px-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <Card className="mx-5 text-center py-8">
          <p className="text-sprout-text-secondary mb-3">Couldn&apos;t load your positions</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </Card>
      ) : hasPositions ? (
        <div className="flex flex-col gap-3">
          {positions.map((position, i) => (
            <PositionCard
              key={`${position.chainId}-${position.asset.address}-${position.protocolName}-${i}`}
              position={position}
              showDetails={isPro}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-5 gap-5">
          <div className="text-center">
            <p className="font-heading text-xl font-700 text-sprout-text-primary">
              No positions yet
            </p>
            <p className="text-sm text-sprout-text-muted mt-2">
              Start earning yield on your crypto
            </p>
          </div>
          <Button onClick={() => router.push("/home")} className="w-full max-w-xs">
            Start Earning
          </Button>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

export default function PortfolioPage() {
  return (
    <AuthGuard>
      <PortfolioContent />
    </AuthGuard>
  );
}
