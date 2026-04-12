"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { PositionCard } from "@/components/portfolio/PositionCard";
import { WalletBalanceCard } from "@/components/portfolio/WalletBalanceCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { usePositions } from "@/lib/hooks/usePositions";
import { useBalances } from "@/lib/hooks/useBalances";
import { formatCurrency } from "@/lib/format";

function PortfolioContent() {
  const router = useRouter();
  const { user } = usePrivy();
  const { preferences } = usePreferences();
  const address = user?.wallet?.address;
  const { positions, loading: positionsLoading, error, reload, totalBalance } = usePositions(address);
  const { balances, loading: balancesLoading } = useBalances(address);

  const isPro = preferences.mode === "pro";
  const hasPositions = positions.length > 0;
  const nonEarning = balances.filter((b) => b.balanceFormatted > 0);
  const hasWallet = nonEarning.length > 0;
  const loading = positionsLoading || balancesLoading;

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-28">
      <Header />

      {/* Portfolio header */}
      <div className="px-5 pt-5 pb-4">
        <p className="font-heading text-2xl font-800 text-sprout-text-primary">Portfolio</p>
        {hasPositions && !loading && (
          <p className="text-sm text-sprout-text-muted mt-1">
            <span className="font-semibold text-sprout-green-dark">
              {formatCurrency(totalBalance)}
            </span>{" "}
            earning
          </p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-3 px-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {!loading && error && (
        <Card className="mx-5 text-center py-8">
          <p className="text-sprout-text-secondary mb-3">Couldn&apos;t load your positions</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Earning section */}
          {hasPositions && (
            <section className="mb-6">
              <div className="flex items-center gap-2 px-5 mb-3">
                <span className="w-2 h-2 rounded-full bg-sprout-green-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-sprout-text-secondary">
                  Earning
                </h2>
                <span className="text-xs text-sprout-text-muted ml-auto">
                  {positions.length} position{positions.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {positions.map((position, i) => (
                  <PositionCard
                    key={`${position.chainId}-${position.asset.address}-${position.protocolName}-${i}`}
                    position={position}
                    showDetails={isPro}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Not Earning section (wallet balances) */}
          {hasWallet && (
            <section className="mb-6">
              <div className="flex items-center gap-2 px-5 mb-3">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-sprout-text-secondary">
                  Not Earning
                </h2>
                <span className="text-xs text-sprout-text-muted ml-auto">
                  {nonEarning.length} token{nonEarning.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {nonEarning.map((balance) => (
                  <WalletBalanceCard
                    key={`${balance.chainId}-${balance.symbol}`}
                    balance={balance}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty state — no positions AND no wallet balances */}
          {!hasPositions && !hasWallet && (
            <div className="flex flex-col items-center justify-center py-20 px-5 gap-5">
              <div className="text-center">
                <p className="font-heading text-xl font-700 text-sprout-text-primary">
                  Your portfolio is empty
                </p>
                <p className="text-sm text-sprout-text-muted mt-2">
                  Add some crypto to your wallet to start earning
                </p>
              </div>
              <Button onClick={() => router.push("/home")} className="w-full max-w-xs">
                Start Earning
              </Button>
            </div>
          )}
        </>
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
