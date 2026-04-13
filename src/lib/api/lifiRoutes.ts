// Thin client for the /api/routes, /api/step-transaction, and
// /api/tx-status proxies. All three forward to li.quest endpoints
// (integrator + api key stamped server-side).
//
// Types intentionally loose — LI.FI's responses include dozens of
// auxiliary fields we don't touch. We narrow via runtime checks at
// the point of use instead of trying to schema-validate the whole
// tree.

export interface LifiToken {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  priceUSD?: string;
  logoURI?: string;
  name?: string;
}

export interface LifiAction {
  fromChainId: number;
  toChainId: number;
  fromToken: LifiToken;
  toToken: LifiToken;
  fromAmount: string;
  slippage?: number;
  fromAddress?: string;
  toAddress?: string;
}

export interface LifiEstimate {
  tool?: string;
  fromAmount: string;
  fromAmountUSD?: string;
  toAmount: string;
  toAmountMin?: string;
  toAmountUSD?: string;
  executionDuration?: number;
  /**
   * ERC20 spender the user must approve before the swap/bridge
   * step can pull the fromToken. LI.FI sets this when the route
   * starts from a non-native ERC20 — we use it to call
   * `approve(spender, amount)` on the vault share token before
   * trying a LI.FI-routed withdrawal.
   */
  approvalAddress?: string;
  gasCosts?: Array<{
    amount?: string;
    amountUSD?: string;
    token?: LifiToken;
  }>;
}

export interface LifiTransactionRequest {
  from?: string;
  to: string;
  data: string;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
  chainId: number;
}

export interface LifiStep {
  id: string;
  type: "swap" | "cross" | "lifi" | "protocol" | string;
  tool: string;
  toolDetails?: {
    key?: string;
    name?: string;
    logoURI?: string;
  };
  action: LifiAction;
  estimate: LifiEstimate;
  transactionRequest?: LifiTransactionRequest;
  includedSteps?: LifiStep[];
  integrator?: string;
  [key: string]: unknown;
}

export interface LifiRoute {
  id: string;
  fromChainId: number;
  fromAmount: string;
  fromAmountUSD?: string;
  fromToken: LifiToken;
  toChainId: number;
  toAmount: string;
  toAmountMin?: string;
  toAmountUSD?: string;
  toToken: LifiToken;
  gasCostUSD?: string;
  steps: LifiStep[];
}

export interface LifiRoutesResponse {
  routes: LifiRoute[];
  unavailableRoutes?: unknown;
}

export interface GetRoutesParams {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
}

export async function getRoutes(
  params: GetRoutesParams
): Promise<LifiRoutesResponse> {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : null) ?? `routes error: ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

/**
 * Refresh a LI.FI step with a ready-to-sign transactionRequest. For
 * multi-step routes, each subsequent step depends on the output of
 * the previous on-chain action, so we re-request the calldata after
 * each hop lands.
 */
export async function populateStep(step: LifiStep): Promise<LifiStep> {
  const res = await fetch("/api/step-transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(step),
  });
  if (!res.ok) {
    throw new Error(`stepTransaction error: ${res.status}`);
  }
  return res.json();
}

export type TransferStatus = "NOT_FOUND" | "INVALID" | "PENDING" | "DONE" | "FAILED";

export interface TransferStatusResponse {
  status: TransferStatus;
  substatus?: string;
  substatusMessage?: string;
  sending?: { txHash?: string; txLink?: string };
  receiving?: { txHash?: string; txLink?: string; chainId?: number };
}

export async function getTransferStatus(params: {
  txHash: string;
  fromChain?: number;
  toChain?: number;
  bridge?: string;
}): Promise<TransferStatusResponse> {
  const qs = new URLSearchParams();
  qs.set("txHash", params.txHash);
  if (params.fromChain !== undefined) qs.set("fromChain", String(params.fromChain));
  if (params.toChain !== undefined) qs.set("toChain", String(params.toChain));
  if (params.bridge) qs.set("bridge", params.bridge);

  const res = await fetch(`/api/tx-status?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`status error: ${res.status}`);
  }
  return res.json();
}
