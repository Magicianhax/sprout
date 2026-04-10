import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatPercent, dailyEarnings } from "@/lib/format";

interface BalanceCardProps {
  totalBalance: number;
  avgApy: number;
}

export function BalanceCard({ totalBalance, avgApy }: BalanceCardProps) {
  const daily = dailyEarnings(totalBalance, avgApy);
  return (
    <Card className="mx-5">
      <p className="text-[13px] text-sprout-text-muted mb-1">Total Balance</p>
      <p className="font-heading text-4xl font-800 text-sprout-text-primary">
        {formatCurrency(totalBalance)}
      </p>
      <div className="flex items-center gap-1.5 mt-2">
        <Badge color="green">+{formatCurrency(daily)} today</Badge>
        <span className="text-xs text-sprout-text-muted">
          earning {formatPercent(avgApy)} yearly
        </span>
      </div>
    </Card>
  );
}
