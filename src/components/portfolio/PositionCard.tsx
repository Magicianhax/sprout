"use client";

import { Card } from "@/components/ui/Card";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatCurrency } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/constants";
import type { Position } from "@/lib/types";
import { useRouter } from "next/navigation";

interface PositionCardProps {
  position: Position;
  showDetails: boolean;
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

  // Positions API doesn't return vault address, so no vault detail navigation
  const handleClick = undefined;

  return (
    <Card onClick={handleClick} shadow="subtle" className="mx-5">
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <TokenIcon type="token" identifier={asset.symbol} size={44} />
        </div>

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

        <div className="text-right shrink-0">
          <p className="font-heading text-sm font-700 text-sprout-text-primary">
            {formatCurrency(balanceUsdNum)}
          </p>
          <p className="text-[11px] text-sprout-text-muted">
            {parseFloat(balanceNative || "0").toFixed(4)} {asset.symbol}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-sprout-border">
        {showDetails && (
          <div className="flex items-center gap-1.5">
            <TokenIcon type="chain" identifier={chainId} size={16} className="rounded-full" />
            <span className="text-xs text-sprout-text-muted">{chainName}</span>
          </div>
        )}
        {!showDetails && <div />}

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
