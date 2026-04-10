import type { ComposerQuote } from "@/lib/types";

export async function getDepositQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}): Promise<ComposerQuote> {
  const searchParams = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
  });
  const res = await fetch(`/api/quote?${searchParams}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Quote failed" }));
    throw new Error(error.message || `Quote error: ${res.status}`);
  }
  return res.json();
}
