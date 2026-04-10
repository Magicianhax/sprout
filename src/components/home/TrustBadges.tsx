const STATS = [
  { value: "$2.1B+", label: "Total deposited" },
  { value: "5.2%", label: "Avg. yearly rate" },
  { value: "20+", label: "Partners" },
];

export function TrustBadges() {
  return (
    <div className="flex justify-center items-center gap-0 mx-5 py-4">
      {STATS.map((stat, i) => (
        <div key={stat.label} className="flex items-center">
          {i > 0 && <div className="w-px h-8 bg-sprout-border mx-4" />}
          <div className="text-center">
            <div className="text-sm font-bold text-sprout-text-primary">{stat.value}</div>
            <div className="text-[11px] text-sprout-text-muted">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
