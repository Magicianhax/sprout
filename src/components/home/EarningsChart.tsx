interface EarningsChartProps {
  className?: string;
}

export function EarningsChart({ className = "" }: EarningsChartProps) {
  return (
    <div className={`mx-5 ${className}`}>
      <div className="h-24 w-full flex items-center justify-center rounded-2xl bg-sprout-green-light/40">
        <p className="text-xs text-sprout-text-muted">
          Earnings history coming soon
        </p>
      </div>
    </div>
  );
}
