"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatCurrency, formatPercent } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/constants";
import type { Position } from "@/lib/types";
import { useRouter } from "next/navigation";

interface PositionCardProps {
  position: Position;
  showDetails: boolean; // true for Pro, false for Lite
}

export function PositionCard({ position, showDetails }: PositionCardProps) {
  const router = useRouter();
  const { vault, balance, balanceUsd, earningsUsd } = position;
  const token = vault.underlyingTokens[0];
  const apy = vault.analytics.apy.total;
  const chainName = CHAIN_NAMES[vault.chainId] ?? `Chain ${vault.chainId}`;

  const handleClick = showDetails
    ? () => router.push(`/vault/${vault.address}?chainId=${vault.chainId}`)
    : undefined;

  return (
    <Card onClick={handleClick} shadow="subtle" className="mx-5">
      <div className="flex items-center gap-3">
        {/* Token icon */}
        <div className="shrink-0">
          {token ? (
            <TokenIcon type="token" identifier={token.symbol} size={44} />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-sprout-green-light flex items-center justify-center text-sprout-green-dark font-bold text-xs">
              ?
            </div>
          )}
        </div>

        {/* Position info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sprout-text-primary text-[15px] truncate leading-tight">
            {token?.symbol ?? vault.name}
          </p>
          {showDetails && (
            <p className="text-xs text-sprout-text-muted mt-0.5 truncate">
              {vault.protocol.name} · {chainName}
            </p>
          )}
        </div>

        {/* APY */}
        <div className="text-right shrink-0">
          <p className="font-heading text-xl font-800 text-sprout-green-dark">
            {formatPercent(apy)}
          </p>
          <p className="text-[11px] text-sprout-text-muted">yearly</p>
        </div>
      </div>

      {/* Balance & Earnings row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sprout-border">
        <div>
          <p className="text-xs text-sprout-text-muted">Balance</p>
          <p className="font-semibold text-sprout-text-primary text-sm mt-0.5">
            {formatCurrency(balanceUsd)}
          </p>
          {token && (
            <p className="text-[11px] text-sprout-text-muted">
              {balance.toFixed(4)} {token.symbol}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-sprout-text-muted">Earnings</p>
          <p className="font-semibold text-sprout-green-dark text-sm mt-0.5">
            +{formatCurrency(earningsUsd)}
          </p>
        </div>
      </div>
    </Card>
  );
}
