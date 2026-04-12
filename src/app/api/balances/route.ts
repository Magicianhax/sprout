import { NextRequest, NextResponse } from "next/server";
import { TOKEN_ADDRESSES, TOKEN_DECIMALS } from "@/lib/constants";

const RPC_URLS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  8453: "https://base.llamarpc.com",
  42161: "https://arbitrum.llamarpc.com",
  10: "https://optimism.llamarpc.com",
  137: "https://polygon.llamarpc.com",
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function hexToNumber(hex: string, decimals: number): number {
  if (!hex || hex === "0x" || hex === "0x0") return 0;
  const clean = hex.replace(/^0x/, "");
  if (!clean) return 0;
  try {
    const raw = parseInt(clean, 16);
    if (!isFinite(raw) || raw === 0) return 0;
    return raw / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

async function rpcCall(
  rpcUrl: string,
  body: object,
  retries = 2,
): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        return null;
      }
      const json = (await res.json()) as { result?: string; error?: unknown };
      if (json.error && attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      return json.result ?? null;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function fetchErc20Balance(
  rpcUrl: string,
  tokenAddress: string,
  walletAddress: string,
  decimals: number,
): Promise<number> {
  const data = "0x70a08231" + walletAddress.slice(2).padStart(64, "0");
  const result = await rpcCall(rpcUrl, {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"],
    id: 1,
  });
  return hexToNumber(result ?? "0x", decimals);
}

async function fetchNativeBalance(rpcUrl: string, walletAddress: string): Promise<number> {
  const result = await rpcCall(rpcUrl, {
    jsonrpc: "2.0",
    method: "eth_getBalance",
    params: [walletAddress, "latest"],
    id: 1,
  });
  return hexToNumber(result ?? "0x", 18);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const tasks: Promise<{ symbol: string; chainId: number; balanceFormatted: number } | null>[] = [];

  for (const [symbol, chainMap] of Object.entries(TOKEN_ADDRESSES)) {
    for (const [chainIdStr, tokenAddress] of Object.entries(chainMap)) {
      const chainId = Number(chainIdStr);
      const rpcUrl = RPC_URLS[chainId];
      if (!rpcUrl) continue;
      const decimals = TOKEN_DECIMALS[symbol] ?? 18;

      tasks.push(
        (async () => {
          try {
            const isNative = tokenAddress === ZERO_ADDRESS;
            const balanceFormatted = isNative
              ? await fetchNativeBalance(rpcUrl, address)
              : await fetchErc20Balance(rpcUrl, tokenAddress, address, decimals);
            return { symbol, chainId, balanceFormatted };
          } catch {
            return null;
          }
        })(),
      );
    }
  }

  const results = await Promise.all(tasks);

  const balances = results
    .filter(
      (r): r is { symbol: string; chainId: number; balanceFormatted: number } =>
        r !== null && r.balanceFormatted > 0,
    )
    .map(({ symbol, chainId, balanceFormatted }) => ({
      symbol,
      chainId,
      balance: balanceFormatted.toString(),
      balanceFormatted,
    }))
    .sort((a, b) => b.balanceFormatted - a.balanceFormatted);

  return NextResponse.json({ balances });
}
