"use client";

import { Card } from "@/components/ui/Card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatCurrency } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/constants";
import type { Position } from "@/lib/types";
import { useRouter } from "next/navigation";

interface PositionCardProps {
  position: Position;
  showDetails: boolean; // true for Pro, false for Lite
}

export function PositionCard({ position, showDetails }: PositionCardProps) {
  const router = useRouter();
  const { asset, protocolName, chainId, balanceUsd, balanceNative } = position;
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  const balanceUsdNum = parseFloat(balanceUsd || "0");

  function handleStopEarning(e: React.MouseEvent) {
    e.stopPropagation();
    const params = new URLSearchParams({
      vault: asset.address,
      chainId: String(chainId),
      protocolName,
      asset: asset.address,
      assetSymbol: asset.symbol,
      assetDecimals: String(asset.decimals),
    });
    router.push(`/withdraw?${params.toString()}`);
  }

  const handleClick = showDetails
    ? () => router.push(`/vault?chainId=${chainId}`)
    : undefined;

  return (
    <Card onClick={handleClick} shadow="subtle" className="mx-5">
      <div className="flex items-center gap-3">
        {/* Token icon */}
        <div className="shrink-0">
          <TokenIcon type="token" identifier={asset.symbol} size={44} />
        </div>

        {/* Position info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sprout-text-primary text-[15px] truncate leading-tight">
            {asset.symbol}
          </p>
          {showDetails && (
            <p className="text-xs text-sprout-text-muted mt-0.5 truncate">
              {protocolName} · {chainName}
            </p>
          )}
        </div>

        {/* Chain badge */}
        <div className="text-right shrink-0">
          <p className="font-heading text-sm font-700 text-sprout-text-secondary">
            {chainName}
          </p>
          <p className="text-[11px] text-sprout-text-muted">{protocolName}</p>
        </div>
      </div>

      {/* Balance row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sprout-border">
        <div>
          <p className="text-xs text-sprout-text-muted">Balance</p>
          <p className="font-semibold text-sprout-text-primary text-sm mt-0.5">
            {formatCurrency(balanceUsdNum)}
          </p>
          <p className="text-[11px] text-sprout-text-muted">
            {balanceNative} {asset.symbol}
          </p>
        </div>

        <button
          className="text-xs font-semibold text-sprout-red-stop cursor-pointer py-1 px-2"
          onClick={handleStopEarning}
        >
          Stop Earning
        </button>
      </div>
    </Card>
  );
}
