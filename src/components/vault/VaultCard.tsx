import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { formatPercent, formatCompactCurrency, parseTvl, getRiskLevel } from "@/lib/format";
import { CHAIN_NAMES } from "@/lib/constants";
import type { Vault } from "@/lib/types";

interface VaultCardProps {
  vault: Vault;
  onClick: () => void;
}

const RISK_COLORS = {
  low: "green",
  medium: "amber",
  high: "red",
} as const;

const RISK_LABELS = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "Higher Risk",
} as const;

export function VaultCard({ vault, onClick }: VaultCardProps) {
  const token = vault.underlyingTokens[0];
  const apy = vault.analytics.apy.total;
  const tvlUsd = parseTvl(vault.analytics.tvl.usd);
  const riskLevel = getRiskLevel(vault.tags);
  const chainName = CHAIN_NAMES[vault.chainId] ?? `Chain ${vault.chainId}`;

  return (
    <Card onClick={onClick} shadow="subtle" className="mx-5">
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

        {/* Vault info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sprout-text-primary text-[15px] truncate leading-tight">
            {vault.name}
          </p>
          <p className="text-xs text-sprout-text-muted mt-0.5 truncate">
            {vault.protocol.name} · {chainName}
          </p>
        </div>

        {/* APY */}
        <div className="text-right shrink-0">
          <p className="font-heading text-xl font-800 text-sprout-green-dark">
            {formatPercent(apy)}
          </p>
          <p className="text-[11px] text-sprout-text-muted">yearly</p>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 mt-3">
        <Badge color="blue">TVL {formatCompactCurrency(tvlUsd)}</Badge>
        <Badge color={RISK_COLORS[riskLevel]}>{RISK_LABELS[riskLevel]}</Badge>
        {token && (
          <Badge color="gray">{token.symbol}</Badge>
        )}
      </div>
    </Card>
  );
}
