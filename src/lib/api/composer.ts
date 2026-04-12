import type { ComposerQuote } from "@/lib/types";
import { isComposerQuote, ApiShapeError } from "@/lib/schemas";

export interface QuoteParams {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
}

async function fetchQuote(params: QuoteParams): Promise<ComposerQuote> {
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
    const error = await res.json().catch(() => null);
    const message =
      (error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : null) ?? `Quote error: ${res.status}`;
    throw new Error(message);
  }

  const json = await res.json().catch(() => null);
  if (!isComposerQuote(json)) {
    throw new ApiShapeError("/api/quote");
  }
  return json;
}

export const getDepositQuote = fetchQuote;
export const getWithdrawQuote = fetchQuote;
