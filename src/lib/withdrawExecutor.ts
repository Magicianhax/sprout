import type { ConnectedWallet } from "@privy-io/react-auth";
import { getWithdrawQuote } from "@/lib/api/composer";
import { toTokenUnits } from "@/lib/format";
import type { Position, Vault } from "@/lib/types";

// Protocols whose vault address is an ERC4626 share token. For these
// we bypass composer entirely and call redeem(shares, receiver, owner)
// or withdraw(assets, receiver, owner) directly on the vault contract.
export const ERC4626_PROTOCOLS = new Set([
  "morpho-v1",
  "morpho-v2",
  "euler-v2",
  "felix-vanilla",
  "seamless",
  "upshift",
  "usdai",
  "hyperlend",
  "neverland",
  "yo-protocol",
]);

// Function selectors (keccak256 first 4 bytes)
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const REDEEM_SELECTOR = "0xba087652"; // redeem(uint256,address,address)
const WITHDRAW_SELECTOR = "0xb460af94"; // withdraw(uint256,address,address)

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
  /** Fires once the tx has been crafted and we're about to prompt the wallet. */
  onConfirming?: () => void;
}

export interface WithdrawExecutorResult {
  txHash: string;
  isFullWithdrawal: boolean;
}

/**
 * Execute a single vault withdrawal. For ERC4626 protocols this uses
 * a direct redeem/withdraw call on the vault contract. For anything
 * else it falls back to a LI.FI composer quote (which has its own
 * limitations — the ERC4626 direct path is preferred).
 */
export async function executeVaultWithdraw(
  opts: WithdrawExecutorOptions
): Promise<WithdrawExecutorResult> {
  const { wallet, position, vault, amount, onConfirming } = opts;

  const fullBalance = parseFloat(position.balanceNative);
  if (!Number.isFinite(fullBalance) || fullBalance <= 0) {
    throw new Error("Nothing to withdraw — your balance is zero.");
  }

  // Clamp the requested amount to the actual balance. Anything within
  // a tiny epsilon of the balance counts as a full withdrawal.
  const requested =
    amount && amount > 0 ? Math.min(amount, fullBalance) : fullBalance;
  const isFullWithdrawal = requested >= fullBalance * 0.9999;
  const numeric = requested;

  if (vault.chainId !== position.chainId) {
    throw new Error("Vault chain mismatch — refusing to send transaction.");
  }

  // ─── ERC4626 direct path ───────────────────────────────────────
  if (ERC4626_PROTOCOLS.has(position.protocolName)) {
    await wallet.switchChain(position.chainId);
    const provider = await wallet.getEthereumProvider();

    const chainHex = (await provider.request({
      method: "eth_chainId",
    })) as string;
    if (parseInt(chainHex, 16) !== position.chainId) {
      throw new Error("Wallet is on the wrong chain. Please switch networks.");
    }

    let data: string;
    if (isFullWithdrawal) {
      const balanceHex = (await provider.request({
        method: "eth_call",
        params: [
          { to: vault.address, data: encodeBalanceOf(wallet.address) },
          "latest",
        ],
      })) as string;

      const shares = BigInt(balanceHex);
      if (shares === BigInt(0)) {
        throw new Error("No shares to redeem — position already empty.");
      }
      data = encodeRedeem(shares, wallet.address, wallet.address);
    } else {
      const assets = BigInt(toTokenUnits(numeric, position.asset.decimals));
      if (assets === BigInt(0)) {
        throw new Error("Withdraw amount rounds to zero.");
      }
      data = encodeWithdraw(assets, wallet.address, wallet.address);
    }

    onConfirming?.();

    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: wallet.address,
          to: vault.address,
          data,
        },
      ],
    })) as string;

    return { txHash: hash, isFullWithdrawal };
  }

  // ─── Composer fallback (non-ERC4626 protocols) ─────────────────
  const fromAmount = toTokenUnits(numeric, position.asset.decimals);

  const quote = await getWithdrawQuote({
    fromChain: position.chainId,
    toChain: position.chainId,
    fromToken: vault.address,
    toToken: position.asset.address,
    fromAmount,
    fromAddress: wallet.address,
  });

  if (quote.transactionRequest.chainId !== position.chainId) {
    throw new Error("Quote returned the wrong chain — aborting.");
  }

  onConfirming?.();

  const { transactionRequest } = quote;
  await wallet.switchChain(transactionRequest.chainId);

  const provider = await wallet.getEthereumProvider();
  const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(chainHex, 16) !== transactionRequest.chainId) {
    throw new Error("Wallet is on the wrong chain. Please switch networks.");
  }

  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: wallet.address,
        to: transactionRequest.to,
        data: transactionRequest.data,
        value:
          transactionRequest.value && transactionRequest.value !== "0"
            ? `0x${BigInt(transactionRequest.value).toString(16)}`
            : undefined,
      },
    ],
  })) as string;

  return { txHash: hash as string, isFullWithdrawal };
}
