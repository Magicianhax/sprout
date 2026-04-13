import { NextRequest, NextResponse } from "next/server";
import {
  ALCHEMY_NETWORK_BY_CHAIN,
  RPC_FETCH_TIMEOUT_MS,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
} from "@/lib/constants";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Build Alchemy RPC URLs from the chain-to-network map. We swapped off
// llamarpc because the public domains were DNS-flaky / rate-limited,
// which was silently dropping balances on OP, Arbitrum, Polygon. We
// already use Alchemy for activity so the key is in env.
function alchemyRpcFor(chainId: number): string | null {
  if (!ALCHEMY_API_KEY) return null;
  const network = ALCHEMY_NETWORK_BY_CHAIN[chainId];
  if (!network) return null;
  return `https://${network}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

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
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(RPC_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        break;
      }
      const json = (await res.json()) as { result?: string; error?: unknown };
      if (json.error) {
        lastError = json.error;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
          continue;
        }
        break;
      }
      return json.result ?? null;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
    }
  }
  console.warn(`[balances] rpc ${rpcUrl} failed after ${retries + 1} attempts`, lastError);
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

interface BalanceResult {
  symbol: string;
  chainId: number;
  balanceFormatted: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!ALCHEMY_API_KEY) {
    console.error("[balances] ALCHEMY_API_KEY not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const address = request.nextUrl.searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const tasks: Promise<BalanceResult | { error: string; symbol: string; chainId: number }>[] = [];

  for (const [symbol, chainMap] of Object.entries(TOKEN_ADDRESSES)) {
    for (const [chainIdStr, tokenAddress] of Object.entries(chainMap)) {
      const chainId = Number(chainIdStr);
      const rpcUrl = alchemyRpcFor(chainId);
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
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[balances] ${symbol}@${chainId} failed: ${message}`);
            return { error: "rpc_failed", symbol, chainId };
          }
        })(),
      );
    }
  }

  const results = await Promise.all(tasks);

  const successes = results.filter(
    (r): r is BalanceResult => "balanceFormatted" in r && r.balanceFormatted > 0,
  );
  const failureCount = results.filter((r) => "error" in r).length;

  const balances = successes
    .map(({ symbol, chainId, balanceFormatted }) => ({
      symbol,
      chainId,
      balance: balanceFormatted.toString(),
      balanceFormatted,
    }))
    .sort((a, b) => b.balanceFormatted - a.balanceFormatted);

  return NextResponse.json(
    {
      balances,
      // Surface partial-failure info so the client can show a stale-data
      // warning instead of pretending the balance list is authoritative.
      partial: failureCount > 0,
      failedCount: failureCount,
    },
    { headers: NO_STORE_HEADERS }
  );
}
