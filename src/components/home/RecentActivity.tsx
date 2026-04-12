"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { CHAIN_NAMES } from "@/lib/constants";
import type { TransferRecord, TransferSide } from "@/lib/types";

interface RecentActivityProps {
  records: TransferRecord[];
  loading?: boolean;
  error?: string | null;
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

export function RecentActivity({ records, loading, error }: RecentActivityProps) {
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
          const crossChain = Boolean(recv && recv.chainId !== send.chainId);
          const link = (recv?.txLink ?? send.txLink) || undefined;
          const sendChainName =
            CHAIN_NAMES[send.chainId] ?? `Chain ${send.chainId}`;
          const recvChainName =
            recv && (CHAIN_NAMES[recv.chainId] ?? `Chain ${recv.chainId}`);
          const amount = formatAmount(send);
          const usd = send.amountUSD
            ? `$${Number(send.amountUSD).toFixed(2)}`
            : null;
          const label = crossChain
            ? `${send.token.symbol} → ${recv?.token.symbol ?? "?"}`
            : `Sent ${send.token.symbol}`;
          const subLabel = crossChain
            ? `${sendChainName} → ${recvChainName}`
            : sendChainName;

          const content = (
            <div className="flex items-center gap-3 bg-sprout-card rounded-2xl px-4 py-3 shadow-subtle">
              <div className="relative shrink-0">
                <TokenIcon type="token" identifier={send.token.symbol} size={36} />
                <div
                  className="absolute -bottom-1 -right-1 rounded-full border-2 border-sprout-card overflow-hidden"
                  style={{ width: 16, height: 16 }}
                >
                  <TokenIcon type="chain" identifier={send.chainId} size={16} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-sprout-text-primary truncate">
                    {label}
                  </p>
                  {crossChain && (
                    <ArrowRight
                      size={12}
                      className="text-sprout-text-muted shrink-0"
                    />
                  )}
                </div>
                <p className="text-[11px] text-sprout-text-muted truncate">
                  {subLabel} · {formatRelativeTime(send.timestamp)}
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-sprout-text-primary">
                  {amount} {send.token.symbol}
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
