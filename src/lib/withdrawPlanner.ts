import type { Position, Vault } from "@/lib/types";

export interface WithdrawStep {
  position: Position;
  /** Underlying-token amount (decimal) to pull from this position. */
  amount: number;
  /** USD value of this step, for display. */
  usd: number;
  /** APY of the source vault at plan-time (percent, e.g. 4.2). */
  apy: number;
}

interface ScoredPosition {
  position: Position;
  balanceUsd: number;
  balanceNative: number;
  apy: number;
  chainPenalty: number;
}

// Higher penalty = avoid withdrawing from this chain first (expensive
// gas). Ethereum mainnet is the most expensive so it gets the biggest
// number; L2s are cheap.
const CHAIN_GAS_PENALTY: Record<number, number> = {
  1: 50, // Ethereum
  137: 2, // Polygon
  10: 1, // Optimism
  42161: 1, // Arbitrum
  8453: 1, // Base
};

function findVaultForPosition(
  position: Position,
  vaults: Vault[]
): Vault | undefined {
  const assetAddr = position.asset.address.toLowerCase();
  return vaults.find(
    (v) =>
      v.chainId === position.chainId &&
      v.protocol.name === position.protocolName &&
      v.underlyingTokens.some((t) => t.address.toLowerCase() === assetAddr)
  );
}

/**
 * Build a withdraw plan covering `requestedUsd` across the user's
 * positions. Positions are sorted so we prefer pulling from the
 * lowest-APY position on the cheapest chain first — that preserves
 * high-yielding capital and keeps gas costs down.
 *
 * Each step specifies an underlying-token amount computed from the
 * position's own USD/native ratio (handles stables 1:1 and volatile
 * assets proportionally).
 */
export function buildWithdrawPlan(
  positions: Position[],
  vaults: Vault[],
  requestedUsd: number
): WithdrawStep[] {
  if (!(requestedUsd > 0)) return [];

  const scored: ScoredPosition[] = [];
  for (const p of positions) {
    const balanceUsd = parseFloat(p.balanceUsd || "0");
    const balanceNative = parseFloat(p.balanceNative || "0");
    if (!(balanceUsd > 0) || !(balanceNative > 0)) continue;
    const vault = findVaultForPosition(p, vaults);
    const apy = vault?.analytics.apy.total ?? 0;
    const chainPenalty = CHAIN_GAS_PENALTY[p.chainId] ?? 10;
    scored.push({
      position: p,
      balanceUsd,
      balanceNative,
      apy,
      chainPenalty,
    });
  }

  // Sort ascending by a composite score: lower APY and cheaper gas
  // bubble to the top (withdraw from those first).
  scored.sort((a, b) => {
    // APY weight dominates since losing 0.5% yield is worse than a
    // few cents of extra gas, but on ties gas decides.
    const scoreA = a.apy * 10 + a.chainPenalty;
    const scoreB = b.apy * 10 + b.chainPenalty;
    return scoreA - scoreB;
  });

  const plan: WithdrawStep[] = [];
  let remainingUsd = requestedUsd;
  // Tiny epsilon to avoid asking for 0.0000001 from a position due to
  // floating-point drift.
  const EPSILON = 0.005;

  for (const s of scored) {
    if (remainingUsd <= EPSILON) break;
    const takeUsd = Math.min(s.balanceUsd, remainingUsd);
    if (takeUsd <= EPSILON) continue;

    // Proportional conversion from USD to underlying using the
    // position's own ratio. For stables this is ~1:1; for non-stables
    // it uses the same price the earn indexer is using so the math
    // is internally consistent.
    const ratio = takeUsd / s.balanceUsd;
    let amount = ratio * s.balanceNative;

    // If we're taking > 99.5% of the position, just withdraw the
    // whole thing — dust avoidance.
    const isNearlyFull = ratio >= 0.995;
    if (isNearlyFull) {
      amount = s.balanceNative;
    }

    plan.push({
      position: s.position,
      amount,
      usd: isNearlyFull ? s.balanceUsd : takeUsd,
      apy: s.apy,
    });
    remainingUsd -= isNearlyFull ? s.balanceUsd : takeUsd;
  }

  return plan;
}

/** Total USD sum of all steps in a plan. */
export function planTotalUsd(plan: WithdrawStep[]): number {
  return plan.reduce((sum, step) => sum + step.usd, 0);
}
