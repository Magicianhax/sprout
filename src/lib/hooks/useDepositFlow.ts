"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import {
  getRoutes,
  getTransferStatus,
  populateStep,
  type LifiStep,
} from "@/lib/api/lifiRoutes";
import {
  encodeAllowance,
  encodeApprove,
  encodeBalanceOf,
  encodeDeposit,
  MAX_UINT256,
} from "@/lib/depositEncoder";
import {
  EXPLORER_TX_URL_BY_CHAIN,
  POSITION_RESYNC_DELAYS_MS,
} from "@/lib/constants";
import { invalidateBalances } from "@/lib/hooks/useBalances";
import { invalidatePositions } from "@/lib/hooks/usePositions";
import { invalidateActivity } from "@/lib/hooks/useActivity";
import type { Vault } from "@/lib/types";

export type DepositPhase =
  | "idle"
  | "quoting"
  | "executing"
  | "success"
  | "error";

export interface DepositStepView {
  id: string;
  label: string;
  chainId?: number;
  status: "pending" | "active" | "done" | "failed";
  txHash?: string;
  txLink?: string;
}

export interface DepositFlowState {
  phase: DepositPhase;
  steps: DepositStepView[];
  activeStepIndex: number;
  errorMessage: string;
  finalTxHash: string;
  finalChainId?: number;
}

const INITIAL: DepositFlowState = {
  phase: "idle",
  steps: [],
  activeStepIndex: -1,
  errorMessage: "",
  finalTxHash: "",
  finalChainId: undefined,
};

function explorerLink(chainId: number | undefined, hash: string): string | undefined {
  if (!chainId) return undefined;
  const base = EXPLORER_TX_URL_BY_CHAIN[chainId];
  return base ? `${base}${hash}` : undefined;
}

function scheduleResync(walletAddress: string): void {
  invalidateBalances(walletAddress).catch(() => {});
  invalidatePositions(walletAddress).catch(() => {});
  invalidateActivity(walletAddress).catch(() => {});
  for (const ms of POSITION_RESYNC_DELAYS_MS) {
    setTimeout(() => {
      invalidateBalances(walletAddress).catch(() => {});
      invalidatePositions(walletAddress).catch(() => {});
      invalidateActivity(walletAddress).catch(() => {});
    }, ms);
  }
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

async function waitForReceipt(
  provider: EthereumProvider,
  txHash: string,
  maxMs = 180_000
): Promise<void> {
  const start = Date.now();
  let delay = 2_000;
  while (Date.now() - start < maxMs) {
    try {
      const receipt = (await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      })) as { status?: string } | null;
      if (receipt && receipt.status !== undefined) {
        if (receipt.status === "0x1") return;
        throw new Error("Transaction reverted on-chain.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("reverted")) throw err;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.2, 5_000);
  }
  throw new Error("Timed out waiting for transaction confirmation.");
}

async function waitForBridge(
  txHash: string,
  fromChain: number,
  toChain: number,
  tool: string | undefined,
  maxMs = 600_000
): Promise<void> {
  const start = Date.now();
  let delay = 4_000;
  while (Date.now() - start < maxMs) {
    try {
      const status = await getTransferStatus({
        txHash,
        fromChain,
        toChain,
        bridge: tool,
      });
      if (status.status === "DONE") return;
      if (status.status === "FAILED" || status.status === "INVALID") {
        throw new Error(
          status.substatusMessage || "Bridge step failed before landing."
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Bridge")) throw err;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.25, 8_000);
  }
  throw new Error("Timed out waiting for the bridge to complete.");
}

async function readAllowance(
  provider: EthereumProvider,
  token: string,
  owner: string,
  spender: string
): Promise<bigint> {
  const data = encodeAllowance(owner, spender);
  try {
    const result = (await provider.request({
      method: "eth_call",
      params: [{ to: token, data }, "latest"],
    })) as string;
    if (!result || result === "0x") return BigInt(0);
    return BigInt(result);
  } catch {
    return BigInt(0);
  }
}

async function readErc20Balance(
  provider: EthereumProvider,
  token: string,
  holder: string
): Promise<bigint> {
  const data = encodeBalanceOf(holder);
  try {
    const result = (await provider.request({
      method: "eth_call",
      params: [{ to: token, data }, "latest"],
    })) as string;
    if (!result || result === "0x") return BigInt(0);
    return BigInt(result);
  } catch {
    return BigInt(0);
  }
}

/**
 * Poll the wallet's balance on the destination chain until it
 * reflects at least `minimumRaw` of the expected token. LI.FI's
 * /v1/status returns DONE as soon as their tracker sees the fill
 * mined, but the user's RPC may still lag by a block or two —
 * trying to deposit at that instant reverts with "transfer amount
 * exceeds balance". Expected caller has already switched the
 * wallet to the destination chain.
 */
async function waitForDestinationBalance(
  provider: EthereumProvider,
  token: string,
  holder: string,
  minimumRaw: bigint,
  maxMs = 300_000
): Promise<bigint> {
  const start = Date.now();
  let delay = 2_500;
  let lastSeen = BigInt(0);
  while (Date.now() - start < maxMs) {
    lastSeen = await readErc20Balance(provider, token, holder);
    if (lastSeen >= minimumRaw) return lastSeen;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.25, 6_000);
  }
  throw new Error(
    "Bridged tokens haven't landed on the destination chain yet. Try again in a minute."
  );
}

async function switchWalletChain(
  wallet: { switchChain: (id: number) => Promise<unknown> },
  provider: EthereumProvider,
  chainId: number
): Promise<void> {
  await wallet.switchChain(chainId);
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(hex, 16) !== chainId) {
    throw new Error(
      "Wallet is on the wrong chain. Please switch networks and retry."
    );
  }
}

/**
 * Single funding source for a deposit. `amountRaw` is in the source
 * token's base units. Multiple sources can target the same vault —
 * the flow bridges each non-vault-chain source in sequence and then
 * does a single approve + deposit on the vault chain with the total
 * received amount.
 */
export interface DepositSource {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  amountRaw: string;
}

export interface StartDepositArgs {
  sources: DepositSource[];
  vault: Vault;
}

type PlanStepKind = "bridge" | "directFund" | "approve" | "deposit";

interface PlanStep {
  kind: PlanStepKind;
  view: DepositStepView;
  lifiStep?: LifiStep;
  source?: DepositSource;
  /** True when this bridge sub-step is the last one in its route —
   *  only the last sub-step contributes `toAmountMin` to the running
   *  deposit total (intermediate steps feed the next on-chain). */
  isRouteTerminal?: boolean;
}

export function useDepositFlow() {
  const { wallets } = useWallets();
  const [state, setState] = useState<DepositFlowState>(INITIAL);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const lastArgsRef = useRef<StartDepositArgs | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback(
    (
      updater:
        | DepositFlowState
        | ((prev: DepositFlowState) => DepositFlowState)
    ) => {
      if (!mountedRef.current) return;
      setState(updater);
    },
    []
  );

  const close = useCallback(() => {
    inFlightRef.current = false;
    lastArgsRef.current = null;
    safeSet(INITIAL);
  }, [safeSet]);

  const run = useCallback(
    async (args: StartDepositArgs) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      lastArgsRef.current = args;

      try {
        const wallet = wallets.find((w) => !!w.address) ?? wallets[0] ?? null;
        if (!wallet) throw new Error("No wallet found. Please reconnect.");

        const underlying = args.vault.underlyingTokens[0];
        if (!underlying?.address) {
          throw new Error("Vault is missing underlying token info.");
        }
        if (args.sources.length === 0) {
          throw new Error("No funding source provided.");
        }

        const destChainId = args.vault.chainId;
        const destTokenAddress = underlying.address;
        const protocolLabel =
          args.vault.protocol.name.replace(/-/g, " ") || "vault";

        safeSet({ ...INITIAL, phase: "quoting" });

        // Normalise sources: put same-chain first (they're free), then
        // cross-chain in order of descending amount. Also drop zero
        // amounts so we never book empty steps.
        const sortedSources = args.sources
          .filter((s) => {
            try {
              return BigInt(s.amountRaw) > BigInt(0);
            } catch {
              return false;
            }
          })
          .sort((a, b) => {
            if (a.chainId === destChainId && b.chainId !== destChainId) return -1;
            if (b.chainId === destChainId && a.chainId !== destChainId) return 1;
            try {
              const diff = BigInt(b.amountRaw) - BigInt(a.amountRaw);
              return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : 0;
            } catch {
              return 0;
            }
          });

        if (sortedSources.length === 0) {
          throw new Error("Nothing to deposit — every source amount is zero.");
        }

        // ── Plan ──────────────────────────────────────────────
        // - One bridge step per cross-chain source.
        // - One directFund marker per same-chain source (no tx, just
        //   tallies into the running total so the UI can show it).
        // - One shared approve + deposit at the end with the full
        //   landed amount.
        const plan: PlanStep[] = [];

        for (const src of sortedSources) {
          if (src.chainId === destChainId) {
            plan.push({
              kind: "directFund",
              source: src,
              view: {
                id: `direct-${src.chainId}`,
                label: `Use ${src.tokenSymbol} on vault chain`,
                chainId: src.chainId,
                status: "pending",
              },
            });
          } else {
            const { routes } = await getRoutes({
              fromChainId: src.chainId,
              toChainId: destChainId,
              fromTokenAddress: src.tokenAddress,
              toTokenAddress: destTokenAddress,
              fromAmount: src.amountRaw,
              fromAddress: wallet.address,
              toAddress: wallet.address,
            });
            const route = routes?.[0];
            if (!route || !route.steps?.length) {
              throw new Error(
                `No bridge route found from chain ${src.chainId} to chain ${destChainId}.`
              );
            }
            // LI.FI may return multi-step routes (swap → bridge →
            // swap). Every step needs a user signature, so we add
            // one plan entry per step. Only the last step's
            // toAmountMin counts toward the deposit total —
            // intermediate outputs feed directly into the next step
            // on-chain.
            route.steps.forEach((lifiStep, idx) => {
              const isLast = idx === route.steps.length - 1;
              const fromChain = lifiStep.action?.fromChainId ?? src.chainId;
              const toChain = lifiStep.action?.toChainId ?? destChainId;
              const crossChain = fromChain !== toChain;
              const fromSym = lifiStep.action?.fromToken?.symbol ?? src.tokenSymbol;
              const toSym = lifiStep.action?.toToken?.symbol ?? underlying.symbol;
              const label = crossChain
                ? `Bridge ${fromSym} → ${toSym}`
                : `Swap ${fromSym} → ${toSym}`;
              plan.push({
                kind: "bridge",
                lifiStep,
                source: src,
                isRouteTerminal: isLast,
                view: {
                  id: `bridge-${lifiStep.id}-${idx}`,
                  label,
                  chainId: fromChain,
                  status: "pending",
                },
              });
            });
          }
        }

        plan.push({
          kind: "approve",
          view: {
            id: "approve",
            label: `Approve ${underlying.symbol}`,
            chainId: destChainId,
            status: "pending",
          },
        });

        plan.push({
          kind: "deposit",
          view: {
            id: "deposit",
            label: `Deposit into ${protocolLabel}`,
            chainId: destChainId,
            status: "pending",
          },
        });

        safeSet({
          ...INITIAL,
          phase: "executing",
          steps: plan.map((p, i) =>
            i === 0 ? { ...p.view, status: "active" } : p.view
          ),
          activeStepIndex: 0,
        });

        // ── Execute ───────────────────────────────────────────
        // Running total of underlying-asset base units currently
        // sitting on the destination chain ready to be deposited.
        // Each same-chain source adds its own amountRaw directly.
        // Each bridge step adds `toAmountMin` (safe lower bound).
        let depositAmountRaw = BigInt(0);
        let finalHash = "";
        let finalChainId: number | undefined;

        const provider =
          (await wallet.getEthereumProvider()) as EthereumProvider;

        for (let i = 0; i < plan.length; i++) {
          const step = plan[i];

          safeSet((prev) => ({
            ...prev,
            activeStepIndex: i,
            steps: prev.steps.map((v, idx) =>
              idx === i ? { ...v, status: "active" } : v
            ),
          }));

          if (step.kind === "directFund" && step.source) {
            try {
              depositAmountRaw += BigInt(step.source.amountRaw);
            } catch {
              // ignore
            }
          } else if (step.kind === "bridge" && step.lifiStep) {
            // Prefer the original step's action for chain info —
            // populateStep occasionally returns a patched step
            // without the full action tree, and crashing on
            // `fresh.action.fromChainId` is a nasty UX failure.
            const original = step.lifiStep;
            const fresh = await populateStep(original);
            const tx = fresh.transactionRequest;
            const stepFromChainId =
              fresh.action?.fromChainId ?? original.action?.fromChainId;
            const stepToChainId =
              fresh.action?.toChainId ?? original.action?.toChainId;
            const targetChainId =
              tx?.chainId ?? stepFromChainId;

            if (
              !tx?.to ||
              !tx?.data ||
              typeof targetChainId !== "number"
            ) {
              throw new Error("Bridge step is missing transaction data.");
            }

            await switchWalletChain(wallet, provider, targetChainId);

            const hash = (await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  from: wallet.address,
                  to: tx.to,
                  data: tx.data,
                  value:
                    tx.value && tx.value !== "0"
                      ? `0x${BigInt(tx.value).toString(16)}`
                      : undefined,
                },
              ],
            })) as string;

            safeSet((prev) => ({
              ...prev,
              steps: prev.steps.map((v, idx) =>
                idx === i
                  ? {
                      ...v,
                      txHash: hash,
                      txLink: explorerLink(targetChainId, hash),
                    }
                  : v
              ),
            }));

            await waitForReceipt(provider, hash);

            // Only poll the LI.FI status endpoint for actual
            // cross-chain hops. An intermediate same-chain swap
            // step in a compound route doesn't need it.
            if (
              typeof stepFromChainId === "number" &&
              typeof stepToChainId === "number" &&
              stepFromChainId !== stepToChainId
            ) {
              await waitForBridge(
                hash,
                stepFromChainId,
                stepToChainId,
                fresh.tool ?? original.tool
              );
            }

            // Only tally the terminal step of each route — every
            // intermediate step's output is consumed by the next
            // on-chain action, so adding it would double-count.
            if (step.isRouteTerminal) {
              const estimate = fresh.estimate ?? original.estimate;
              const minOut =
                estimate?.toAmountMin ?? estimate?.toAmount;
              if (minOut) {
                try {
                  depositAmountRaw += BigInt(minOut);
                } catch {
                  // keep running total
                }
              }
            }
          } else if (step.kind === "approve") {
            if (depositAmountRaw <= BigInt(0)) {
              throw new Error(
                "Nothing landed on the destination chain to deposit."
              );
            }
            await switchWalletChain(wallet, provider, destChainId);

            // Wait for the bridged tokens to actually show up on
            // the destination chain. LI.FI's /v1/status can flip
            // to DONE a block or two before the user's RPC
            // reflects it, and skipping this would hand us a
            // "transfer amount exceeds balance" revert on the
            // deposit. We only require the planned deposit
            // amount — any extra pre-existing balance on the
            // vault chain is *not* folded in, because the user
            // didn't ask to deposit it.
            await waitForDestinationBalance(
              provider,
              destTokenAddress,
              wallet.address,
              depositAmountRaw
            );

            const current = await readAllowance(
              provider,
              destTokenAddress,
              wallet.address,
              args.vault.address
            );

            if (current >= depositAmountRaw) {
              safeSet((prev) => ({
                ...prev,
                steps: prev.steps.map((v, idx) =>
                  idx === i ? { ...v, status: "done" } : v
                ),
              }));
              continue;
            }

            const data = encodeApprove(args.vault.address, MAX_UINT256);
            const hash = (await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  from: wallet.address,
                  to: destTokenAddress,
                  data,
                },
              ],
            })) as string;

            safeSet((prev) => ({
              ...prev,
              steps: prev.steps.map((v, idx) =>
                idx === i
                  ? { ...v, txHash: hash, txLink: explorerLink(destChainId, hash) }
                  : v
              ),
            }));

            await waitForReceipt(provider, hash);
          } else if (step.kind === "deposit") {
            await switchWalletChain(wallet, provider, destChainId);

            if (depositAmountRaw <= BigInt(0)) {
              throw new Error("Deposit amount is zero.");
            }

            const data = encodeDeposit(depositAmountRaw, wallet.address);
            const hash = (await provider.request({
              method: "eth_sendTransaction",
              params: [
                {
                  from: wallet.address,
                  to: args.vault.address,
                  data,
                },
              ],
            })) as string;

            safeSet((prev) => ({
              ...prev,
              steps: prev.steps.map((v, idx) =>
                idx === i
                  ? { ...v, txHash: hash, txLink: explorerLink(destChainId, hash) }
                  : v
              ),
            }));

            await waitForReceipt(provider, hash);

            finalHash = hash;
            finalChainId = destChainId;
          }

          safeSet((prev) => ({
            ...prev,
            steps: prev.steps.map((v, idx) =>
              idx === i ? { ...v, status: "done" } : v
            ),
          }));
        }

        scheduleResync(wallet.address);

        safeSet((prev) => ({
          ...prev,
          phase: "success",
          finalTxHash: finalHash,
          finalChainId,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Deposit failed";
        safeSet((prev) => ({
          ...prev,
          phase: "error",
          errorMessage: message,
          steps: prev.steps.map((v, idx) =>
            idx === prev.activeStepIndex ? { ...v, status: "failed" } : v
          ),
        }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [wallets, safeSet]
  );

  const start = useCallback(
    (args: StartDepositArgs) => {
      void run(args);
    },
    [run]
  );

  const retry = useCallback(() => {
    if (!lastArgsRef.current) return;
    const args = lastArgsRef.current;
    safeSet({ ...INITIAL });
    void run(args);
  }, [run, safeSet]);

  const modalStatus: "confirming" | "success" | "error" | null =
    state.phase === "success"
      ? "success"
      : state.phase === "error"
      ? "error"
      : state.phase === "quoting" || state.phase === "executing"
      ? "confirming"
      : null;

  return { state, start, retry, close, modalStatus };
}
