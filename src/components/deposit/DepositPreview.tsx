import { Card } from "@/components/ui/Card";
import { dailyEarnings, monthlyEarnings, formatCurrency } from "@/lib/format";

interface DepositPreviewProps {
  amount: number;
  apyPercent: number;
  networkFeeUsd: number;
}

export function DepositPreview({ amount, apyPercent, networkFeeUsd }: DepositPreviewProps) {
  const daily = dailyEarnings(amount, apyPercent);
  const monthly = monthlyEarnings(amount, apyPercent);

  return (
    <Card className="w-full">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-sprout-text-primary">Earnings Preview</h3>

        <PreviewRow label="Earning rate" value={`${apyPercent.toFixed(1)}%/year`} />
        <PreviewRow label="Daily earnings" value={`~${formatCurrency(daily)}`} highlight />
        <PreviewRow label="Monthly earnings" value={`~${formatCurrency(monthly)}`} highlight />

        <div className="h-px bg-sprout-border my-1" />

        <PreviewRow
          label="Network fee"
          value={networkFeeUsd > 0 ? `~${formatCurrency(networkFeeUsd)}` : "—"}
          muted
        />
      </div>
    </Card>
  );
}

interface PreviewRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}

function PreviewRow({ label, value, highlight, muted }: PreviewRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-sprout-text-secondary">{label}</span>
      <span
        className={`text-sm font-semibold ${
          muted
            ? "text-sprout-text-muted"
            : highlight
            ? "text-sprout-green-dark"
            : "text-sprout-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
