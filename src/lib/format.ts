export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(0)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function parseTvl(tvlString: string): number {
  return parseFloat(tvlString) || 0;
}

export function formatTokenAmount(amount: string, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}

export function toTokenUnits(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}

export function getRiskLevel(tags: string[]): "low" | "medium" | "high" {
  const hasHighRisk = tags.some((t) => t === "il-risk" || t === "leveraged");
  if (hasHighRisk) return "high";
  const hasStable = tags.some((t) => t === "stablecoin" || t === "single");
  if (hasStable) return "low";
  return "medium";
}

export function dailyEarnings(balance: number, apyPercent: number): number {
  return (balance * (apyPercent / 100)) / 365;
}

export function monthlyEarnings(balance: number, apyPercent: number): number {
  return (balance * (apyPercent / 100)) / 12;
}
