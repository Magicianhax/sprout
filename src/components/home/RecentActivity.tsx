"use client";

import {
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
import type { TransferRecord, TransferSide, Vault } from "@/lib/types";

interface RecentActivityProps {
  records: TransferRecord[];
  loading?: boolean;
  error?: string | null;
}

type ActivityKind = "deposit" | "withdraw" | "bridge" | "swap" | "send";

interface Classification {
  kind: ActivityKind;
  label: string;
  subLabel: string;
}

function formatAmount(side: TransferSide): string {
  try {
    const decimals = side.token.decimals ?? 18;
    const big = BigInt(side.amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = big / divisor;
    const frac = big % divisor;
    const fracStr = (Number(frac) / Number(divisor)).toFixed(4).slice(2);
    return `${whole.toString()}.${fracStr}`;
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

function findVault(
  vaults: Vault[],
  chainId: number,
  tokenAddress: string
): Vault | undefined {
  const target = tokenAddress.toLowerCase();
  return vaults.find(
    (v) =>
      v.chainId === chainId && v.address.toLowerCase() === target
  );
}

function classify(record: TransferRecord, vaults: Vault[]): Classification {
  const send = record.sending;
  const recv = record.receiving;
  const sendChain = CHAIN_NAMES[send.chainId] ?? `Chain ${send.chainId}`;

  if (!recv) {
    return {
      kind: "send",
      label: `Sent ${send.token.symbol}`,
      subLabel: sendChain,
    };
  }

  const recvChain = CHAIN_NAMES[recv.chainId] ?? `Chain ${recv.chainId}`;
  const sameChain = send.chainId === recv.chainId;
  const sameToken =
    send.token.address.toLowerCase() === recv.token.address.toLowerCase();

  // Deposit — user sent something, received a vault share token.
  const receivedVault = findVault(vaults, recv.chainId, recv.token.address);
  if (receivedVault) {
    return {
      kind: "deposit",
      label: `Deposited into ${displayProtocol(receivedVault.protocol.name)}`,
      subLabel: sameChain ? recvChain : `${sendChain} → ${recvChain}`,
    };
  }

  // Withdraw via composer (rare — our ERC4626 path skips LI.FI) — user sent
  // a vault share, received the underlying.
  const sentVault = findVault(vaults, send.chainId, send.token.address);
  if (sentVault) {
    return {
      kind: "withdraw",
      label: `Withdrew from ${displayProtocol(sentVault.protocol.name)}`,
      subLabel: sameChain ? sendChain : `${sendChain} → ${recvChain}`,
    };
  }

  if (sameChain && sameToken) {
    return {
      kind: "send",
      label: `Sent ${send.token.symbol}`,
      subLabel: sendChain,
    };
  }

  if (!sameChain && sameToken) {
    return {
      kind: "bridge",
      label: `Bridged ${send.token.symbol}`,
      subLabel: `${sendChain} → ${recvChain}`,
    };
  }

  // Different tokens — swap (same chain) or cross-chain swap
  return {
    kind: "swap",
    label: `${send.token.symbol} → ${recv.token.symbol}`,
    subLabel: sameChain ? sendChain : `${sendChain} → ${recvChain}`,
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
    case "send":
    default:
      return {
        icon: <ArrowUpRight size={14} strokeWidth={2.5} />,
        className: "bg-gray-500 text-white",
      };
  }
}

export function RecentActivity({ records, loading, error }: RecentActivityProps) {
  // Read from the shared vault cache so we can label vault interactions.
  // No cost if useVaults has already been called elsewhere — this just
  // subscribes to the stream. If it hasn't been called, this triggers
  // the load and the labels will upgrade themselves as vaults land.
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

  if (records.length === 0) {
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
        {records.map((record) => {
          const send = record.sending;
          const recv = record.receiving;
          const link = (recv?.txLink ?? send.txLink) || undefined;
          const { kind, label, subLabel } = classify(record, vaults);
          const badge = kindBadge(kind);

          // For deposits we show what went in (sending side)
          // For withdraws we show what came out (receiving side)
          // For everything else we show sending
          const amountSide = kind === "withdraw" && recv ? recv : send;
          const amount = formatAmount(amountSide);
          const usd = amountSide.amountUSD
            ? `$${Number(amountSide.amountUSD).toFixed(2)}`
            : null;
          const amountSymbol = amountSide.token.symbol;
          const amountPrefix =
            kind === "deposit"
              ? "-"
              : kind === "withdraw"
              ? "+"
              : kind === "send"
              ? "-"
              : "";

          const content = (
            <div className="flex items-center gap-3 bg-sprout-card rounded-2xl px-4 py-3 shadow-subtle">
              {/* Token icon with the kind badge overlay */}
              <div className="relative shrink-0">
                <TokenIcon
                  type="token"
                  identifier={amountSide.token.symbol}
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
                  {subLabel} · {formatRelativeTime(send.timestamp)}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-bold ${
                    kind === "withdraw"
                      ? "text-sprout-green-dark"
                      : kind === "deposit" || kind === "send"
                      ? "text-sprout-text-primary"
                      : "text-sprout-text-primary"
                  }`}
                >
                  {amountPrefix}
                  {amount} {amountSymbol}
                </p>
                {usd && (
                  <p className="text-[11px] text-sprout-text-muted">{usd}</p>
                )}
              </div>

              {link && (
                <ExternalLink
                  size={14}
                  className="text-sprout-text-muted shrink-0"
                />
              )}
            </div>
          );

          return link ? (
            <a
              key={record.transactionId}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {content}
            </a>
          ) : (
            <div key={record.transactionId}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
