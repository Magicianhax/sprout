import { formatCurrency } from "@/lib/format";
import type { Position } from "@/lib/types";

interface ActivityItem {
  id: string;
  type: "deposit" | "earning";
  label: string;
  sublabel: string;
  amount: number;
  amountLabel: string;
}

function buildActivityItems(positions: Position[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const position of positions) {
    const tokenSymbol = position.vault.underlyingTokens[0]?.symbol ?? "Token";
    const vaultName = position.vault.name;

    if (position.balanceUsd > 0) {
      items.push({
        id: `deposit-${position.vault.address}`,
        type: "deposit",
        label: `Started earning on ${tokenSymbol}`,
        sublabel: vaultName,
        amount: position.balanceUsd,
        amountLabel: formatCurrency(position.balanceUsd),
      });
    }

    if (position.earningsUsd > 0) {
      items.push({
        id: `earning-${position.vault.address}`,
        type: "earning",
        label: `Earned on ${tokenSymbol}`,
        sublabel: "Yield collected",
        amount: position.earningsUsd,
        amountLabel: `+${formatCurrency(position.earningsUsd)}`,
      });
    }
  }

  return items;
}

interface RecentActivityProps {
  positions: Position[];
}

export function RecentActivity({ positions }: RecentActivityProps) {
  const items = buildActivityItems(positions);

  if (items.length === 0) return null;

  return (
    <div className="mx-5">
      <h3 className="text-sm font-semibold text-sprout-text-secondary mb-3">Recent Activity</h3>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-subtle"
          >
            {/* Icon */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0
                ${item.type === "deposit" ? "bg-sprout-green-light" : "bg-sprout-amber-warm"}`}
            >
              {item.type === "deposit" ? "🌱" : "✨"}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sprout-text-primary truncate">
                {item.label}
              </p>
              <p className="text-xs text-sprout-text-muted truncate">{item.sublabel}</p>
            </div>

            {/* Amount */}
            <span
              className={`text-sm font-bold shrink-0
                ${item.type === "earning" ? "text-sprout-green-dark" : "text-sprout-text-primary"}`}
            >
              {item.amountLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
