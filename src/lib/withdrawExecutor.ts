import type { ConnectedWallet } from "@privy-io/react-auth";
import { toTokenUnits } from "@/lib/format";
import {
  getRoutes,
  getTransferStatus,
  populateStep,
  type LifiStep,
} from "@/lib/api/lifiRoutes";
import {
  encodeAllowance,
  encodeApprove,
  MAX_UINT256,
} from "@/lib/depositEncoder";
import type { Position, Vault } from "@/lib/types";

// Function selectors (keccak256 first 4 bytes)
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const REDEEM_SELECTOR = "0xba087652"; // redeem(uint256,address,address)
const WITHDRAW_SELECTOR = "0xb460af94"; // withdraw(uint256,address,address)
const ASSET_SELECTOR = "0x38d52e0f"; // asset() — ERC4626

/**
 * Sentinel error raised whenever the user explicitly cancels a
 * wallet prompt. We rethrow this without catching so the
 * withdraw flow stops instead of silently trying another path.
 */
class UserRejectedError extends Error {
  constructor(message = "Transaction cancelled by user.") {
    super(message);
    this.name = "UserRejectedError";
  }
}

/**
 * EIP-1193 providers signal a user rejection via code 4001
 * (the spec), but Privy's embedded wallet and some browser
 * extensions wrap it as -32603 with "rejected"/"denied" in the
 * message. Also matches ethers/viem style `ACTION_REJECTED`
 * strings. Any of these means "the user said no" — never a
 * reason to fall back to another route.
 */
function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown; name?: unknown };
  if (e.code === 4001 || e.code === "ACTION_REJECTED") return true;
  if (typeof e.name === "string" && e.name === "UserRejectedError") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected by user") ||
    msg.includes("request rejected") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("transaction declined")
  );
}

/**
 * Cheap on-chain probe: does this vault implement ERC4626 and
 * return the underlying we expect? Used to decide whether to
 * try a direct redeem first or jump straight to LI.FI routing.
 * EtherFi's weETH, Lido's stETH, Curve LP wrappers, etc. all
 * fail this check and should exit via LI.FI swap.
 */
async function supportsErc4626(
  provider: EthereumProvider,
  vaultAddress: string,
  expectedUnderlying: string
): Promise<boolean> {
  try {
    const result = (await provider.request({
      method: "eth_call",
      params: [{ to: vaultAddress, data: ASSET_SELECTOR }, "latest"],
    })) as string;
    if (!result || result === "0x" || result.length < 66) return false;
    const returnedAddress = `0x${result.slice(-40)}`.toLowerCase();
    return returnedAddress === expectedUnderlying.toLowerCase();
  } catch {
    return false;
  }
}

function hex32(value: string | bigint): string {
  const hex =
    typeof value === "bigint"
      ? value.toString(16)
      : value.replace(/^0x/, "").toLowerCase();
  return hex.padStart(64, "0");
}

function encodeBalanceOf(holder: string): string {
  return `${BALANCE_OF_SELECTOR}${hex32(holder)}`;
}

function encodeRedeem(shares: bigint, receiver: string, owner: string): string {
  return `${REDEEM_SELECTOR}${hex32(shares)}${hex32(receiver)}${hex32(owner)}`;
}

function encodeWithdraw(
  assets: bigint,
  receiver: string,
  owner: string
): string {
  return `${WITHDRAW_SELECTOR}${hex32(assets)}${hex32(receiver)}${hex32(owner)}`;
}

export interface WithdrawExecutorOptions {
  wallet: ConnectedWallet;
  position: Position;
  vault: Vault;
  /** Underlying asset amount (decimal). Undefined → full position. */
  amount?: number;
  /**
   * Optional cross-chain / cross-token exit target. When set, the
   * withdrawn funds end up as this token on this chain instead of
   * the vault's underlying on the same chain.
   */
  toChainId?: number;
  toTokenAddress?: string;
  /**
   * Skip the direct ERC4626 redeem probe and go straight to LI.FI
   * swap/bridge. Set when the user explicitly picked a different
   * destination chain or output token — in those cases a same-
   * chain redeem doesn't fulfil their intent anyway, and trying
   * it first just wastes a wallet prompt on the rare edge case
   * where the user's custom choice happens to match the default.
   */
  preferLifiSwap?: boolean;
  /** Fires once the tx has been crafted and we're about to prompt the wallet. */
  onConfirming?: () => void;
}

export interface WithdrawExecutorResult {
  txHash: string;
  isFullWithdrawal: boolean;
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

async function readBalance(
  provider: EthereumProvider,
  token: string,
  holder: string
): Promise<bigint> {
  const data = encodeBalanceOf(holder);
  const result = (await provider.request({
    method: "eth_call",
    params: [{ to: token, data }, "latest"],
  })) as string;
  if (!result || result === "0x") return BigInt(0);
  return BigInt(result);
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

async function switchWalletChain(
  wallet: ConnectedWallet,
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
 * Sign every step in a LI.FI route in order, waiting for each to
 * land on-chain (and — if cross-chain — for LI.FI's /v1/status to
 * return DONE) before moving to the next. Returns the final tx
 * hash so the caller can surface an explorer link.
 */
async function executeLifiRoute(
  wallet: ConnectedWallet,
  provider: EthereumProvider,
  steps: LifiStep[]
): Promise<string> {
  let finalHash = "";
  for (const original of steps) {
    const fresh = await populateStep(original);
    const tx = fresh.transactionRequest;
    const stepFromChain =
      fresh.action?.fromChainId ?? original.action?.fromChainId;
    const stepToChain =
      fresh.action?.toChainId ?? original.action?.toChainId;
    const targetChainId = tx?.chainId ?? stepFromChain;

    if (!tx?.to || !tx?.data || typeof targetChainId !== "number") {
      throw new Error("Withdraw step is missing transaction data.");
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

    await waitForReceipt(provider, hash);

    if (
      typeof stepFromChain === "number" &&
      typeof stepToChain === "number" &&
      stepFromChain !== stepToChain
    ) {
      await waitForBridge(
        hash,
        stepFromChain,
        stepToChain,
        fresh.tool ?? original.tool
      );
    }

    finalHash = hash;
  }
  return finalHash;
}

/**
 * Ensure `spender` has at least `amountRaw` allowance on `token`.
 * If not, prompt the user to approve MAX_UINT256. Used before
 * triggering a LI.FI swap that pulls vault shares from the wallet.
 */
async function ensureAllowance(
  wallet: ConnectedWallet,
  provider: EthereumProvider,
  token: string,
  spender: string,
  amountRaw: bigint
): Promise<void> {
  const current = await readAllowance(provider, token, wallet.address, spender);
  if (current >= amountRaw) return;

  const data = encodeApprove(spender, MAX_UINT256);
  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from: wallet.address, to: token, data }],
  })) as string;
  await waitForReceipt(provider, hash);
}

/**
 * Try to exit the vault via LI.FI (swap vault share → output
 * token, optionally cross-chain). Returns the final tx hash on
 * success, or null if LI.FI has no route for this pair — the
 * caller should then fall back to direct ERC4626 redeem.
 */
async function tryLifiWithdraw(
  wallet: ConnectedWallet,
  provider: EthereumProvider,
  vault: Vault,
  shares: bigint,
  targetChainId: number,
  targetTokenAddress: string
): Promise<string | null> {
  let routesResponse;
  try {
    routesResponse = await getRoutes({
      fromChainId: vault.chainId,
      toChainId: targetChainId,
      fromTokenAddress: vault.address,
      toTokenAddress: targetTokenAddress,
      fromAmount: shares.toString(),
      fromAddress: wallet.address,
      toAddress: wallet.address,
    });
  } catch {
    // Route lookup failed (no liquidity, upstream 400). Return
    // null so the caller can fall back to direct redeem. Route
    // lookups are pure API calls and can't be user-cancelled.
    return null;
  }

  const route = routesResponse.routes?.[0];
  if (!route || !route.steps || route.steps.length === 0) return null;

  // The first step must pull vault shares from the wallet. LI.FI
  // routers (via their diamond) use transferFrom, so we need an
  // explicit ERC20 approval first. Skip the step if the wallet
  // already has sufficient allowance.
  const spender = route.steps[0].estimate?.approvalAddress;
  if (spender) {
    await switchWalletChain(wallet, provider, vault.chainId);
    try {
      await ensureAllowance(wallet, provider, vault.address, spender, shares);
    } catch (err) {
      // User rejected the approval prompt — stop the flow
      // entirely, don't silently fall back to direct redeem.
      if (isUserRejection(err)) {
        throw new UserRejectedError(
          "You cancelled the approval. Withdrawal stopped."
        );
      }
      return null;
    }
  }

  try {
    const hash = await executeLifiRoute(wallet, provider, route.steps);
    return hash;
  } catch (err) {
    // User rejected one of the route steps — bubble up and
    // let the caller surface "cancelled by user" instead of
    // falling back to another path.
    if (isUserRejection(err)) {
      throw new UserRejectedError(
        "You cancelled the withdrawal in your wallet."
      );
    }
    // Non-rejection failure (rpc error, revert, timeout) —
    // return null so the caller can try the direct path.
    return null;
  }
}

/**
 * Execute a single vault withdrawal. Priority order:
 *
 *   1. **Direct ERC4626 redeem** — if the vault passes the
 *      `asset()` probe and the user wants to receive the
 *      underlying on the vault's own chain, call `redeem(shares)`
 *      or `withdraw(assets)` straight on the vault contract.
 *      Zero slippage, one tx, always the right price.
 *
 *   2. **LI.FI swap / bridge** — used when any of:
 *        - the vault isn't ERC4626 (EtherFi weETH, Lido stETH,
 *          Curve LP wrappers — `asset()` either reverts or
 *          returns something other than `position.asset.address`),
 *        - the user picked a cross-chain exit,
 *        - the user picked a different output token than the
 *          vault's underlying,
 *        - or the direct redeem reverted at the wallet for any
 *          reason and we need a fallback.
 *      LI.FI's multi-step route is signed in order; share-token
 *      approval to its router is handled automatically.
 *
 * Partial withdrawals skip LI.FI entirely — LI.FI routes work
 * in fromAmount units and mapping a user's underlying-amount
 * request to the right share count is a per-vault conversion
 * we don't want to compute. Partial exits are always direct.
 */
export async function executeVaultWithdraw(
  opts: WithdrawExecutorOptions
): Promise<WithdrawExecutorResult> {
  const {
    wallet,
    position,
    vault,
    amount,
    toChainId,
    toTokenAddress,
    preferLifiSwap,
    onConfirming,
  } = opts;

  const fullBalance = parseFloat(position.balanceNative);
  if (!Number.isFinite(fullBalance) || fullBalance <= 0) {
    throw new Error("Nothing to withdraw — your balance is zero.");
  }

  const requested =
    amount && amount > 0 ? Math.min(amount, fullBalance) : fullBalance;
  const isFullWithdrawal = requested >= fullBalance * 0.9999;

  if (vault.chainId !== position.chainId) {
    throw new Error("Vault chain mismatch — refusing to send transaction.");
  }

  await wallet.switchChain(position.chainId);
  const provider =
    (await wallet.getEthereumProvider()) as EthereumProvider;

  const chainHex = (await provider.request({
    method: "eth_chainId",
  })) as string;
  if (parseInt(chainHex, 16) !== position.chainId) {
    throw new Error("Wallet is on the wrong chain. Please switch networks.");
  }

  const resolvedTargetChain = toChainId ?? position.chainId;
  const resolvedTargetToken = toTokenAddress ?? position.asset.address;
  const wantsDifferentOutput =
    resolvedTargetChain !== position.chainId ||
    resolvedTargetToken.toLowerCase() !== position.asset.address.toLowerCase();

  // ─── Partial withdrawal ──────────────────────────────────────
  if (!isFullWithdrawal) {
    if (wantsDifferentOutput) {
      throw new Error(
        "Cross-chain partial withdrawals aren't supported yet. Exit the full position or withdraw on the vault's own chain."
      );
    }

    const assets = BigInt(toTokenUnits(requested, position.asset.decimals));
    if (assets === BigInt(0)) {
      throw new Error("Withdraw amount rounds to zero.");
    }

    onConfirming?.();

    const data = encodeWithdraw(assets, wallet.address, wallet.address);
    try {
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: vault.address, data }],
      })) as string;
      return { txHash: hash, isFullWithdrawal: false };
    } catch (err) {
      if (isUserRejection(err)) {
        throw new UserRejectedError(
          "You cancelled the withdrawal in your wallet."
        );
      }
      throw err;
    }
  }

  // ─── Full withdrawal ─────────────────────────────────────────
  // Prefer the share count our on-chain positions builder
  // already captured — it was read via Alchemy as part of
  // /api/vault-shares, so it's the same RPC that confirmed the
  // position exists. Reading again through the user's wallet
  // provider sometimes races behind because Privy's default RPC
  // for chains like Base occasionally lags a block or two.
  let shares = BigInt(0);
  if (position.shareBalanceRaw) {
    try {
      shares = BigInt(position.shareBalanceRaw);
    } catch {
      shares = BigInt(0);
    }
  }
  if (shares === BigInt(0)) {
    shares = await readBalance(provider, vault.address, wallet.address);
  }
  // Last-resort: query Alchemy server-side via the same
  // /api/vault-shares route that built the position in the
  // first place. Covers the case where the user's wallet RPC
  // is lagging but the authoritative Alchemy view still shows
  // a balance.
  if (shares === BigInt(0)) {
    try {
      const res = await fetch("/api/vault-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: vault.chainId,
          address: wallet.address,
          vaults: [vault.address],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          held?: Array<{ address: string; shareBalance?: string }>;
        };
        const match = data.held?.find(
          (h) => h.address.toLowerCase() === vault.address.toLowerCase()
        );
        if (match?.shareBalance) {
          try {
            shares = BigInt(match.shareBalance);
          } catch {
            // keep zero
          }
        }
      }
    } catch {
      // ignore — fall through to the empty error below
    }
  }
  if (shares === BigInt(0)) {
    throw new Error("No shares to redeem — position already empty.");
  }

  // 1. Direct ERC4626 is preferred when the vault actually is
  //    ERC4626 AND the user wants the vault's own underlying on
  //    its own chain. `preferLifiSwap` lets callers (Pro mode
  //    destination picker) skip the probe entirely — the user
  //    explicitly asked for a different destination, we trust
  //    them and route straight through LI.FI.
  const canDirectRedeem =
    !preferLifiSwap &&
    !wantsDifferentOutput &&
    (await supportsErc4626(provider, vault.address, position.asset.address));

  if (canDirectRedeem) {
    onConfirming?.();
    const data = encodeRedeem(shares, wallet.address, wallet.address);
    try {
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet.address, to: vault.address, data }],
      })) as string;
      return { txHash: hash, isFullWithdrawal: true };
    } catch (err) {
      // User explicitly rejected the wallet prompt — stop the
      // flow. Silently trying LI.FI next would re-prompt them
      // and come across as Sprout ignoring their decision.
      if (isUserRejection(err)) {
        throw new UserRejectedError(
          "You cancelled the withdrawal in your wallet."
        );
      }
      // Otherwise the direct redeem reverted for some non-user
      // reason (vault gated withdrawals, gas estimation failed,
      // etc.) — fall through to the LI.FI swap fallback.
      console.warn("[withdraw] direct redeem reverted, trying LI.FI", err);
    }
  }

  // 2. LI.FI fallback: route the shares to the user's target
  //    token, whether that's the vault's underlying on its own
  //    chain (because the direct path wasn't available) or a
  //    user-picked cross-chain / cross-token exit.
  onConfirming?.();

  const lifiHash = await tryLifiWithdraw(
    wallet,
    provider,
    vault,
    shares,
    resolvedTargetChain,
    resolvedTargetToken
  );
  if (lifiHash) {
    return { txHash: lifiHash, isFullWithdrawal: true };
  }

  // Neither path works. If the user wanted a specific target
  // we can't silently redeem to the vault's own chain — that
  // would land funds in the wrong place.
  if (wantsDifferentOutput) {
    throw new Error(
      "No exit route available for this vault share. Try receiving the vault's own chain, or pick a different destination."
    );
  }

  throw new Error(
    "This vault doesn't support direct withdrawal and LI.FI has no swap route for its share token."
  );
}
