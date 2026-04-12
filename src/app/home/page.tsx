"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ProtocolDropdown } from "@/components/vault/ProtocolDropdown";
import { SortToggle } from "@/components/vault/SortToggle";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BalanceHeroSkeleton, VaultCardSkeleton } from "@/components/ui/CardSkeletons";
import { PoweredByLifi } from "@/components/ui/PoweredByLifi";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { usePositions } from "@/lib/hooks/usePositions";
import { useVaults } from "@/lib/hooks/useVaults";
import { formatCurrency, getRiskLevel } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/constants";
import { displayProtocol } from "@/lib/protocols";
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
        <div className="flex flex-col gap-5 pt-2">
          <BalanceHeroSkeleton />
          <VaultCardSkeleton />
          <VaultCardSkeleton />
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

      <PoweredByLifi className="pb-5" />
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
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("tvl");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { vaults, loading, loadingMore, error, reload } = useVaults({
    chainIds: selectedChains.length > 0 ? selectedChains : undefined,
    sortBy,
  });

  const assetFilteredVaults = useMemo(
    () => filterVaultsByAsset(vaults, assetFilter),
    [vaults, assetFilter]
  );

  // Derive protocol list from vaults already narrowed by chain + asset filters
  const availableProtocols = useMemo(() => {
    const set = new Set<string>();
    for (const v of assetFilteredVaults) set.add(v.protocol.name);
    return Array.from(set);
  }, [assetFilteredVaults]);

  const protocolFilteredVaults = useMemo(() => {
    if (selectedProtocols.length === 0) return assetFilteredVaults;
    const set = new Set(selectedProtocols);
    return assetFilteredVaults.filter((v) => set.has(v.protocol.name));
  }, [assetFilteredVaults, selectedProtocols]);

  const visibleVaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return protocolFilteredVaults;
    return protocolFilteredVaults.filter((v) => {
      const chainName = (CHAIN_NAMES[v.chainId] ?? `Chain ${v.chainId}`).toLowerCase();
      const protocolRaw = v.protocol.name.toLowerCase();
      const protocolPretty = displayProtocol(v.protocol.name).toLowerCase();
      const name = v.name.toLowerCase();
      const tokenSymbols = v.underlyingTokens.map((t) => t.symbol.toLowerCase());
      return (
        chainName.includes(q) ||
        protocolRaw.includes(q) ||
        protocolPretty.includes(q) ||
        name.includes(q) ||
        tokenSymbols.some((s) => s.includes(q))
      );
    });
  }, [protocolFilteredVaults, searchQuery]);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(visibleVaults.length / PAGE_SIZE));

  // Reset to first page when filters/sort/search change
  useEffect(() => {
    setPage(1);
  }, [selectedChains, selectedProtocols, sortBy, assetFilter, searchQuery]);

  // Clamp page if list shrinks
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedVaults = useMemo(
    () => visibleVaults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visibleVaults, page]
  );

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

      {/* Search bar */}
      <div className="px-5 mt-4 mb-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sprout-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search token, chain, or protocol"
            className="w-full bg-white border border-sprout-border rounded-pill pl-10 pr-10 py-2.5 text-sm text-sprout-text-primary placeholder:text-sprout-text-muted shadow-subtle focus:outline-none focus:border-sprout-green-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sprout-text-muted hover:text-sprout-text-primary cursor-pointer"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap px-5 mb-3">
        <ProtocolDropdown
          available={availableProtocols}
          selected={selectedProtocols}
          onChange={setSelectedProtocols}
        />
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
        <div className="flex flex-col gap-3">
          <VaultCardSkeleton />
          <VaultCardSkeleton />
          <VaultCardSkeleton />
          <VaultCardSkeleton />
        </div>
      ) : error ? (
        <Card className="mx-5 text-center py-8">
          <p className="text-sprout-text-secondary mb-3">Couldn&apos;t load opportunities</p>
          <Button variant="secondary" onClick={reload}>Try again</Button>
        </Card>
      ) : visibleVaults.length === 0 ? (
        <div className="mx-5 mt-4 text-center text-sm text-sprout-text-muted py-10">
          No vaults found for selected filters.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pagedVaults.map((vault) => (
              <VaultCard
                key={`${vault.chainId}-${vault.address}`}
                vault={vault}
                onClick={() =>
                  router.push(`/vault/${vault.address}?chainId=${vault.chainId}`)
                }
              />
            ))}
          </div>

          {loadingMore && (
            <div className="flex items-center justify-center gap-2 mt-4 px-5 text-xs text-sprout-text-muted">
              <span className="w-3 h-3 rounded-full border-2 border-sprout-green-primary border-t-transparent animate-spin" />
              Loading more opportunities…
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 px-5 mt-5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-sprout-border shadow-subtle text-sprout-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs font-semibold text-sprout-text-secondary">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-sprout-border shadow-subtle text-sprout-text-primary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      <PoweredByLifi className="pb-5" />
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
