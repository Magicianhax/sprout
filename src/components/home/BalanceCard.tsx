import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPercent, dailyEarnings } from "@/lib/format";

interface BalanceCardProps {
  /** Total wallet value (earning positions + idle token holdings). */
  totalBalance: number;
  /** Slice of totalBalance that's deposited into earning protocols. */
  earningBalance: number;
  avgApy: number;
}

export function BalanceCard({
  totalBalance,
  earningBalance,
  avgApy,
}: BalanceCardProps) {
  const daily = avgApy > 0 ? dailyEarnings(earningBalance, avgApy) : null;

  return (
    <Card className="mx-5">
      <p className="text-[13px] text-sprout-text-muted mb-1">Total Balance</p>
      <p className="font-heading text-4xl font-800 text-sprout-text-primary">
        {formatCurrency(totalBalance)}
      </p>
      {earningBalance > 0 && (
        <p className="text-xs font-semibold text-sprout-green-dark mt-1">
          {formatCurrency(earningBalance)} earning
        </p>
      )}
      {daily !== null && (
        <div className="flex items-center gap-1.5 mt-3">
          <Badge color="green">+{formatCurrency(daily)} today</Badge>
          <span className="text-xs text-sprout-text-muted">
            earning {formatPercent(avgApy)} yearly
          </span>
        </div>
      )}
    </Card>
  );
}
