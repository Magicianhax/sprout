"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { usePositions } from "@/lib/hooks/usePositions";
import { fetchVaults } from "@/lib/api/earn";
import {
  formatPercent,
  formatCompactCurrency,
  formatCurrency,
  parseTvl,
  getRiskLevel,
} from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/constants";
import type { Vault } from "@/lib/types";


const RISK_DESCRIPTIONS: Record<"low" | "medium" | "high", string> = {
  low: "This vault holds stablecoin assets with minimal price volatility. Smart contract risk is present in all DeFi protocols, but this vault uses audited, battle-tested code. Suitable for users who want to preserve principal while earning yield.",
  medium:
    "This vault involves some price exposure or liquidity risk. Returns may vary based on market conditions. Smart contract risk is present. Only deposit funds you are comfortable with at moderate risk.",
  high: "This vault carries significant risk including impermanent loss, leverage, or high volatility. You could lose a substantial portion of your deposit. Only use with funds you can afford to lose.",
};

const TAG_LABELS: Record<string, string> = {
  stablecoin: "Stablecoin",
  single: "Single Asset",
  "blue-chip": "Blue Chip",
  multi: "Multi Asset",
  "il-risk": "IL Risk",
  leveraged: "Leveraged",
  lending: "Lending",
  "yield-farming": "Yield Farming",
};

function RateHistoryChart({ apy }: { apy: number }) {
  const [range, setRange] = useState<"1W" | "1M" | "1Y">("1W");
  const [mode, setMode] = useState<"rate" | "tvl">("rate");

  // Demo paths that vary by range — illustrative for hackathon
  const paths = {
    "1W": "M0,40 Q40,38 80,35 T160,32 T240,28 T300,25",
    "1M": "M0,50 Q50,45 100,38 T200,30 T280,22 T300,20",
    "1Y": "M0,65 Q60,55 120,45 T200,35 T260,25 T300,18",
  };

  return (
    <div className="bg-white rounded-card p-4 shadow-subtle">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-sprout-text-primary">Rate History</span>
        <div className="flex gap-1">
          {(["1W", "1M", "1Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-0.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors
                ${range === r ? "bg-sprout-green-light text-sprout-green-dark" : "text-sprout-text-muted"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <svg width="100%" height="80" viewBox="0 0 300 80" className="block">
        <defs>
          <linearGradient id="rate-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4CAF50" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="25" x2="300" y2="25" stroke="#F3F4F6" strokeWidth="1" />
        <line x1="0" y1="45" x2="300" y2="45" stroke="#F3F4F6" strokeWidth="1" />
        <line x1="0" y1="65" x2="300" y2="65" stroke="#F3F4F6" strokeWidth="1" />
        <path d={paths[range]} fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
        <path d={`${paths[range]} L300,80 L0,80 Z`} fill="url(#rate-fill)" />
      </svg>

      <div className="flex justify-between items-center mt-2">
        <span className="text-[11px] text-sprout-text-muted">Current: {apy.toFixed(1)}%</span>
        <div className="flex gap-1.5">
          {(["rate", "tvl"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors capitalize
                ${mode === m ? "bg-sprout-green-light text-sprout-green-dark" : "text-sprout-text-muted"}`}
            >
              {m === "rate" ? "Rate" : "TVL"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VaultDetailContent({ vault, chainId }: { vault: Vault; chainId: number }) {
  const router = useRouter();
  const { user } = usePrivy();
  const address = user?.wallet?.address;
  const { positions } = usePositions(address);

  const token = vault.underlyingTokens[0];
  const apy = vault.analytics.apy.total;
  const tvlUsd = parseTvl(vault.analytics.tvl.usd);
  const riskLevel = getRiskLevel(vault.tags);
  const chainName = CHAIN_NAMES[vault.chainId] ?? `Chain ${vault.chainId}`;

  const userPosition = positions.find(
    (p) =>
      p.asset.address.toLowerCase() === (vault.underlyingTokens[0]?.address ?? "").toLowerCase() &&
      p.chainId === vault.chainId
  );

  const hasPosition = Boolean(userPosition);

  function handleEarnMore() {
    router.push(`/deposit?vault=${vault.address}&chainId=${chainId}`);
  }

  function handleStopEarning() {
    const token = vault.underlyingTokens[0];
    const params = new URLSearchParams({
      vault: vault.address,
      chainId: String(vault.chainId),
      protocolName: vault.protocol.name,
      asset: token?.address ?? "",
      assetSymbol: token?.symbol ?? "",
      assetDecimals: String(token?.decimals ?? 18),
    });
    router.push(`/withdraw?${params.toString()}`);
  }

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-16">
      {/* Back header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-sprout-text-primary" />
        </button>
        <span className="font-heading text-lg font-700 text-sprout-text-primary flex-1">
          Vault Details
        </span>
        <Badge color="blue" className="text-[11px]">
          PRO
        </Badge>
      </div>

      <div className="flex flex-col gap-4 px-5">
        {/* Vault identity card */}
        <Card shadow="card">
          {/* Token icon + name + subtitle */}
          <div className="flex items-center gap-3 mb-4">
            <div className="shrink-0">
              {token ? (
                <TokenIcon type="token" identifier={token.symbol} size={52} />
              ) : (
                <div
                  className="rounded-xl bg-sprout-green-light flex items-center justify-center text-sprout-green-dark font-bold text-sm"
                  style={{ width: 52, height: 52 }}
                >
                  ?
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-lg font-700 text-sprout-text-primary truncate leading-tight">
                {vault.name}
              </p>
              <p className="text-sm text-sprout-text-muted mt-0.5">
                {vault.protocol.name} · {chainName}
              </p>
            </div>
          </div>

          {/* Stats grid 2x2 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Yearly Rate — green */}
            <div className="bg-green-50 rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-green-700 mb-1 uppercase tracking-wide">
                Yearly Rate
              </p>
              <p className="font-heading text-xl font-800 text-green-800">
                {formatPercent(apy)}
              </p>
            </div>

            {/* Total Deposited — amber */}
            <div className="bg-amber-50 rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-1 uppercase tracking-wide">
                Total Deposited
              </p>
              <p className="font-heading text-xl font-800 text-amber-800">
                {formatCompactCurrency(tvlUsd)}
              </p>
            </div>

            {/* Asset — blue */}
            <div className="bg-blue-50 rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-blue-700 mb-1 uppercase tracking-wide">
                Asset
              </p>
              <p className="font-heading text-xl font-800 text-blue-800">
                {token?.symbol ?? "—"}
              </p>
            </div>

            {/* Chain — purple */}
            <div className="bg-purple-50 rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-purple-700 mb-1 uppercase tracking-wide">
                Chain
              </p>
              <p className="font-heading text-xl font-800 text-purple-800 truncate">
                {chainName}
              </p>
            </div>
          </div>

          {/* Tags row */}
          {vault.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {vault.tags.map((tag) => (
                <Badge key={tag} color="gray">
                  {TAG_LABELS[tag] ?? tag}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* Position card — only if user has position */}
        {hasPosition && userPosition && (
          <Card shadow="subtle">
            <p className="text-xs font-semibold text-sprout-text-muted uppercase tracking-wide mb-3">
              Your Position
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-heading text-2xl font-800 text-sprout-text-primary">
                  {formatCurrency(parseFloat(userPosition.balanceUsd || "0"))}
                </p>
                <p className="text-sm text-sprout-text-muted mt-0.5">
                  Current balance
                </p>
              </div>
              <div className="text-right">
                <Badge color="green" className="text-sm px-3 py-1">
                  {userPosition.balanceNative} {userPosition.asset.symbol}
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 items-center">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleEarnMore}
          >
            {hasPosition ? "Earn More" : "Start Earning"}
          </Button>
          {hasPosition && (
            <Button
              variant="danger-text"
              className="shrink-0 px-4"
              onClick={handleStopEarning}
            >
              Stop Earning
            </Button>
          )}
        </div>

        {/* Rate history chart */}
        <Card shadow="subtle" className="overflow-hidden !p-5">
          <p className="font-heading text-base font-700 text-sprout-text-primary mb-4">
            Rate History
          </p>
          <div className="-mx-5">
            <RateHistoryChart apy={apy} />
          </div>
        </Card>

        {/* About protocol */}
        {vault.protocol.url && (
          <Card shadow="subtle">
            <p className="font-heading text-base font-700 text-sprout-text-primary mb-2">
              About {vault.protocol.name}
            </p>
            <a
              href={vault.protocol.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-green-dark hover:underline"
            >
              Visit website
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Card>
        )}

        {/* Risk info */}
        <div
          className="rounded-card p-5 border"
          style={{ backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" }}
        >
          <div className="flex gap-3">
            <Info
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: "#92400E" }}
            />
            <div>
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "#92400E" }}
              >
                Risk Information
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#92400E" }}>
                {RISK_DESCRIPTIONS[riskLevel]}
              </p>
            </div>
          </div>
        </div>

        {/* Start Earning CTA — only if no position */}
        {!hasPosition && (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleEarnMore}
          >
            Start Earning
          </Button>
        )}
      </div>
    </main>
  );
}

function VaultDetailLoader() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const vaultAddress = params.id;
  const chainId = Number(searchParams.get("chainId") ?? 0);

  const [vault, setVault] = useState<Vault | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultAddress) return;

    let cancelled = false;

    async function loadVault() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchVaults(
          chainId ? { chainId } : undefined
        );
        if (cancelled) return;

        const found = response.data.find(
          (v) =>
            v.address.toLowerCase() === vaultAddress.toLowerCase() &&
            (!chainId || v.chainId === chainId)
        );

        if (!found) {
          setError("Vault not found.");
        } else {
          setVault(found);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load vault data."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVault();

    return () => {
      cancelled = true;
    };
  }, [vaultAddress, chainId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="font-heading text-lg text-sprout-green-dark animate-pulse">
          Loading vault…
        </div>
      </div>
    );
  }

  if (error || !vault) {
    return (
      <main className="min-h-dvh bg-sprout-gradient">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-sprout-text-primary" />
          </button>
          <span className="font-heading text-lg font-700 text-sprout-text-primary">
            Vault Details
          </span>
        </div>
        <div className="mx-5 mt-4 bg-red-50 rounded-2xl p-4 text-sm text-red-600">
          {error ?? "Vault not found."}
        </div>
      </main>
    );
  }

  return <VaultDetailContent vault={vault} chainId={chainId} />;
}

export default function VaultDetailPage() {
  return (
    <AuthGuard>
      <VaultDetailLoader />
    </AuthGuard>
  );
}
