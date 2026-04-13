// Minimal ABI encoders for ERC20 approval, allowance reads, and
// ERC4626 deposit. We keep this hand-rolled (no viem/ethers) for
// parity with withdrawExecutor.ts — the calldata format is simple
// enough that a couple of padStarts are clearer than pulling in a
// full encoder.

const APPROVE_SELECTOR = "0x095ea7b3"; // approve(address,uint256)
const ALLOWANCE_SELECTOR = "0xdd62ed3e"; // allowance(address,address)
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const DEPOSIT_SELECTOR = "0x6e553f65"; // deposit(uint256,address)

function hex32(value: string | bigint): string {
  const hex =
    typeof value === "bigint"
      ? value.toString(16)
      : value.replace(/^0x/, "").toLowerCase();
  return hex.padStart(64, "0");
}

export function encodeApprove(spender: string, amount: bigint): string {
  return `${APPROVE_SELECTOR}${hex32(spender)}${hex32(amount)}`;
}

export function encodeAllowance(owner: string, spender: string): string {
  return `${ALLOWANCE_SELECTOR}${hex32(owner)}${hex32(spender)}`;
}

export function encodeBalanceOf(holder: string): string {
  return `${BALANCE_OF_SELECTOR}${hex32(holder)}`;
}

export function encodeDeposit(assets: bigint, receiver: string): string {
  return `${DEPOSIT_SELECTOR}${hex32(assets)}${hex32(receiver)}`;
}

export const MAX_UINT256 =
  BigInt(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  );
