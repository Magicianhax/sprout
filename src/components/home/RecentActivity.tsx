"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ExternalLink,
  MoveUp,
  Sprout,
} from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { CHAIN_NAMES } from "@/lib/constants";
import { displayProtocol } from "@/lib/protocols";
import { useVaults } from "@/lib/hooks/useVaults";
import type { ActivityGroup, Vault, WalletTransfer } from "@/lib/types";

interface RecentActivityProps {
  records: ActivityGroup[];
  loading?: boolean;
  error?: string | null;
}

type ActivityKind =
  | "deposit"
  | "withdraw"
  | "swap"
  | "bridge"
  | "send"
  | "receive";

interface Classification {
  kind: ActivityKind;
  label: string;
  subLabel: string;
  primary: WalletTransfer;
}

function formatAmount(amount: string, decimals: number): string {
  try {
    const big = BigInt(amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = big / divisor;
    const frac = big % divisor;
    // 4 significant fractional digits
    const fracScaled = (Number(frac) / Number(divisor)).toFixed(4).slice(2);
    return `${whole.toString()}.${fracScaled}`;
  } catch {
    return "—";
  }
}

function formatRelativeTime(unixSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - unixSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function findVaultByAddress(
  vaults: Vault[],
  chainId: number,
  address: string | null
): Vault | undefined {
  if (!address) return undefined;
  const target = address.toLowerCase();
  return vaults.find(
    (v) => v.chainId === chainId && v.address.toLowerCase() === target
  );
}

// Whitelist of symbols we consider "real" beyond the vault cache.
// Stables, major wrappers, liquid staking. Case-insensitive.
const KNOWN_TOKEN_SYMBOLS = new Set([
  "ETH",
  "POL",
  "MATIC",
  "WETH",
  "WBTC",
  "USDC",
  "USDC.E",
  "USDT",
  "USDT0",
  "DAI",
  "USDS",
  "FRAX",
  "LUSD",
  "CRVUSD",
  "GHO",
  "PYUSD",
  "TUSD",
  "STETH",
  "WSTETH",
  "CBETH",
  "CBBTC",
  "RETH",
  "WEETH",
  "EETH",
]);

function isRecognizedTransfer(t: WalletTransfer, vaults: Vault[]): boolean {
  // Native chain token is always fine
  if (t.token.address === null) return true;
  // Known token symbol
  if (KNOWN_TOKEN_SYMBOLS.has(t.token.symbol.toUpperCase())) return true;
  // Vault share token (from the useVaults cache)
  if (findVaultByAddress(vaults, t.chainId, t.token.address)) return true;
  // Counterparty is a vault contract (e.g. direct deposit)
  if (findVaultByAddress(vaults, t.chainId, t.counterparty)) return true;
  return false;
}


function classify(group: ActivityGroup, vaults: Vault[]): Classification {
  const transfers = group.transfers;
  const chainName = CHAIN_NAMES[group.chainId] ?? `Chain ${group.chainId}`;

  // --- Detect vault interactions ---
  // A deposit shows up as: outflow of underlying + inflow of share token.
  // A withdraw shows up as: outflow of share token + inflow of underlying.
  // Either side is enough to identify the vault.
  for (const t of transfers) {
    // Match by token (share token itself is the vault address)
    const vaultByToken = findVaultByAddress(vaults, t.chainId, t.token.address);
    if (vaultByToken) {
      if (t.direction === "in") {
        // shares minted to user → deposit
        const underlying =
          transfers.find((x) => x.direction === "out" && x !== t) ?? t;
        return {
          kind: "deposit",
          label: `Deposited into ${displayProtocol(vaultByToken.protocol.name)}`,
          subLabel: chainName,
          primary: underlying,
        };
      }
      // shares burned from user → withdraw
      const underlying =
        transfers.find((x) => x.direction === "in" && x !== t) ?? t;
      return {
        kind: "withdraw",
        label: `Withdrew from ${displayProtocol(vaultByToken.protocol.name)}`,
        subLabel: chainName,
        primary: underlying,
      };
    }

    // Match by counterparty (direct interaction with vault contract)
    const vaultByCounter = findVaultByAddress(
      vaults,
      t.chainId,
      t.counterparty
    );
    if (vaultByCounter) {
      if (t.direction === "out") {
        return {
          kind: "deposit",
          label: `Deposited into ${displayProtocol(vaultByCounter.protocol.name)}`,
          subLabel: chainName,
          primary: t,
        };
      }
      return {
        kind: "withdraw",
        label: `Withdrew from ${displayProtocol(vaultByCounter.protocol.name)}`,
        subLabel: chainName,
        primary: t,
      };
    }
  }

  // --- Not a vault tx ---
  // If the group has both an outflow and an inflow of different tokens,
  // it's a swap (same chain) or looks like one. Otherwise it's a plain
  // send/receive.
  const outs = transfers.filter((t) => t.direction === "out");
  const ins = transfers.filter((t) => t.direction === "in");

  if (outs.length > 0 && ins.length > 0) {
    const out = outs[0];
    const inc = ins[0];
    if (out.token.symbol !== inc.token.symbol) {
      return {
        kind: "swap",
        label: `${out.token.symbol} → ${inc.token.symbol}`,
        subLabel: chainName,
        primary: out,
      };
    }
  }

  if (outs.length > 0) {
    const out = outs[0];
    return {
      kind: "send",
      label: `Sent ${out.token.symbol}`,
      subLabel: chainName,
      primary: out,
    };
  }

  const inc = ins[0] ?? transfers[0];
  return {
    kind: "receive",
    label: `Received ${inc.token.symbol}`,
    subLabel: chainName,
    primary: inc,
  };
}

function kindBadge(kind: ActivityKind) {
  switch (kind) {
    case "deposit":
      return {
        icon: <Sprout size={14} strokeWidth={2.5} />,
        className: "bg-sprout-green-primary text-white",
      };
    case "withdraw":
      return {
        icon: <MoveUp size={14} strokeWidth={2.5} />,
        className: "bg-sprout-red-stop text-white",
      };
    case "bridge":
      return {
        icon: <ArrowLeftRight size={14} strokeWidth={2.5} />,
        className: "bg-blue-500 text-white",
      };
    case "swap":
      return {
        icon: <ArrowLeftRight size={14} strokeWidth={2.5} />,
        className: "bg-purple-500 text-white",
      };
    case "receive":
      return {
        icon: <ArrowDownLeft size={14} strokeWidth={2.5} />,
        className: "bg-emerald-500 text-white",
      };
    case "send":
    default:
      return {
        icon: <ArrowUpRight size={14} strokeWidth={2.5} />,
        className: "bg-gray-500 text-white",
      };
  }
}

export function RecentActivity({ records, loading, error }: RecentActivityProps) {
  const { vaults } = useVaults();

  if (loading) {
    return (
      <div className="mx-5 text-sm text-sprout-text-muted animate-pulse">
        Loading activity…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-5 text-sm text-sprout-red-stop">
        Couldn&apos;t load activity — {error}
      </div>
    );
  }

  // Filter out groups that have no recognizable transfers. Also strip
  // unrecognized transfers *inside* each group so the classifier never
  // picks a spam row as the "primary" display transfer.
  const visibleGroups = records
    .map((g) => ({
      ...g,
      transfers: g.transfers.filter((t) => isRecognizedTransfer(t, vaults)),
    }))
    .filter((g) => g.transfers.length > 0);

  if (visibleGroups.length === 0) {
    return (
      <div className="mx-5 text-center text-sm text-sprout-text-muted py-6">
        No activity yet. Your deposits and transfers will show up here.
      </div>
    );
  }

  return (
    <div className="mx-5">
      <h3 className="text-sm font-semibold text-sprout-text-secondary mb-3">
        Recent Activity
      </h3>
      <div className="flex flex-col gap-2">
        {visibleGroups.map((group) => {
          const { kind, label, subLabel, primary } = classify(group, vaults);
          const badge = kindBadge(kind);

          const amount = formatAmount(primary.amount, primary.token.decimals);
          const amountPrefix =
            kind === "deposit" || kind === "send" || kind === "swap"
              ? "-"
              : kind === "withdraw" || kind === "receive"
              ? "+"
              : "";

          const amountTone =
            kind === "withdraw" || kind === "receive"
              ? "text-sprout-green-dark"
              : "text-sprout-text-primary";

          const content = (
            <div className="flex items-center gap-3 bg-sprout-card rounded-2xl px-4 py-3 shadow-subtle">
              <div className="relative shrink-0">
                <TokenIcon
                  type="token"
                  identifier={primary.token.symbol}
                  size={36}
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full border-2 border-sprout-card flex items-center justify-center ${badge.className}`}
                  aria-hidden="true"
                >
                  {badge.icon}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sprout-text-primary truncate">
                  {label}
                </p>
                <p className="text-[11px] text-sprout-text-muted truncate">
                  {subLabel} · {formatRelativeTime(group.timestamp)}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${amountTone}`}>
                  {amountPrefix}
                  {amount} {primary.token.symbol}
                </p>
              </div>

              <ExternalLink
                size={14}
                className="text-sprout-text-muted shrink-0"
              />
            </div>
          );

          return (
            <a
              key={group.id}
              href={group.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
