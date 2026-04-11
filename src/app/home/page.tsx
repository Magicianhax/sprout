"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { BalanceCard } from "@/components/home/BalanceCard";
import { EarningsChart } from "@/components/home/EarningsChart";
import { EmptyState } from "@/components/home/EmptyState";
import { TrustBadges } from "@/components/home/TrustBadges";
import { RecentActivity } from "@/components/home/RecentActivity";
import { VaultCard } from "@/components/vault/VaultCard";
import { ChainDropdown } from "@/components/vault/ChainDropdown";
import { SortToggle } from "@/components/vault/SortToggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { usePositions } from "@/lib/hooks/usePositions";
import { useVaults } from "@/lib/hooks/useVaults";
import { formatCurrency, getRiskLevel } from "@/lib/format";
import type { SortBy, Vault } from "@/lib/types";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function LiteHome() {
  const { user } = usePrivy();
  const router = useRouter();
  const address = user?.wallet?.address;
  const { positions, loading, error, reload, totalBalance } = usePositions(address);

  const hasPositions = positions.length > 0;

  // APY data is not available from the positions endpoint; show balance only
  const avgApy = 0;

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-28">
      <Header />

      <div className="px-5 pt-4 pb-2">
        <p className="font-heading text-2xl font-700 text-sprout-text-primary">
          {getGreeting()} 👋
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-5 pt-2 px-5">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
        <Card className="mx-5 text-center py-8">
          <p className="text-sprout-text-secondary mb-3">Couldn&apos;t load your positions</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </Card>
      ) : hasPositions ? (
        <div className="flex flex-col gap-5 pt-2">
          <BalanceCard totalBalance={totalBalance} avgApy={avgApy} />
          <EarningsChart />

          <div className="px-5 flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => router.push("/deposit")}
            >
              Earn More
            </Button>
            <button
              className="text-center text-sm text-sprout-red-stop font-semibold py-1 cursor-pointer"
              onClick={() => router.push("/portfolio")}
            >
              Stop Earning
            </button>
          </div>

          <RecentActivity positions={positions} />
        </div>
      ) : (
        <>
          <EmptyState onStartEarning={() => router.push("/deposit")} />
          <TrustBadges />
        </>
      )}

      <BottomNav />
    </main>
  );
}

const ASSET_FILTERS = [
  { label: "All", value: "all" },
  { label: "Stables", value: "stables", symbols: ["USDC", "USDT", "DAI", "USDS", "FRAX", "LUSD", "CRVUSD", "GHO", "PYUSD", "TUSD"] },
  { label: "ETH", value: "eth", symbols: ["ETH", "WETH", "STETH", "WSTETH", "RETH", "CBETH", "WEETH", "EETH", "METH", "SWETH", "OSETH", "SFRXETH"] },
  { label: "BTC", value: "btc", symbols: ["BTC", "WBTC", "TBTC", "CBBTC", "SBTC", "RENBTC", "LBTC"] },
  { label: "Low Risk", value: "low-risk" },
];

function filterVaultsByAsset(vaults: Vault[], filter: string): Vault[] {
  if (filter === "all") return vaults;

  if (filter === "low-risk") {
    return vaults.filter((v) => getRiskLevel(v.tags) === "low");
  }

  const filterDef = ASSET_FILTERS.find((f) => f.value === filter);
  if (!filterDef || !("symbols" in filterDef) || !filterDef.symbols) return vaults;

  const symbols = new Set(filterDef.symbols.map((s) => s.toUpperCase()));
  return vaults.filter((v) =>
    v.underlyingTokens.some((t) => symbols.has(t.symbol.toUpperCase()))
  );
}

function ProHome() {
  const { user } = usePrivy();
  const router = useRouter();
  const address = user?.wallet?.address;
  const { totalBalance, positions } = usePositions(address);

  const [selectedChains, setSelectedChains] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("tvl");
  const [assetFilter, setAssetFilter] = useState<string>("all");

  const { vaults, loading, error, reload } = useVaults({
    chainIds: selectedChains.length > 0 ? selectedChains : undefined,
    sortBy,
  });

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-28">
      <Header />

      {/* Compact balance bar */}
      {totalBalance > 0 && (
        <div className="mx-5 mt-3 flex items-center gap-3 bg-white rounded-2xl px-4 py-2.5 shadow-subtle">
          <div className="flex-1 min-w-0">
            <span className="font-heading text-base font-700 text-sprout-text-primary">
              {formatCurrency(totalBalance)}
            </span>
          </div>
          <span className="text-xs font-semibold text-sprout-text-secondary shrink-0">
            {positions.length} position{positions.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Filter row */}
      <div className="flex items-center gap-2 px-5 mt-4 mb-3">
        <span className="font-heading text-base font-700 text-sprout-text-primary flex-1">
          Opportunities
        </span>
        <ChainDropdown selected={selectedChains} onChange={setSelectedChains} />
        <SortToggle value={sortBy} onChange={setSortBy} />
      </div>

      {/* Asset filter pills */}
      <div className="flex gap-2 px-5 mb-3 overflow-x-auto">
        {ASSET_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setAssetFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer
              ${assetFilter === f.value
                ? "bg-sprout-green-primary text-white"
                : "bg-white text-sprout-text-secondary border border-sprout-border"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Vault list */}
      {loading ? (
        <div className="flex flex-col gap-3 px-5">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <Card className="mx-5 text-center py-8">
          <p className="text-sprout-text-secondary mb-3">Couldn&apos;t load opportunities</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </Card>
      ) : vaults.length === 0 ? (
        <div className="mx-5 mt-4 text-center text-sm text-sprout-text-muted py-10">
          No vaults found for selected filters.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filterVaultsByAsset(vaults, assetFilter).map((vault) => (
            <VaultCard
              key={`${vault.chainId}-${vault.address}`}
              vault={vault}
              onClick={() =>
                router.push(`/vault/${vault.address}?chainId=${vault.chainId}`)
              }
            />
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}

export default function HomePage() {
  const { preferences } = usePreferences();

  return (
    <AuthGuard>
      {preferences.mode === "pro" ? <ProHome /> : <LiteHome />}
    </AuthGuard>
  );
}
