import { NextRequest, NextResponse } from "next/server";
import { API_FETCH_TIMEOUT_MS, LIFI_API_BASE } from "@/lib/constants";

const LIFI_API_KEY = process.env.LIFI_API_KEY;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

const STATUS_QUERY_ALLOWLIST = new Set([
  "txHash",
  "fromChain",
  "toChain",
  "bridge",
]);

// GET /api/tx-status?txHash=...&fromChain=...&toChain=...&bridge=...
// Proxy to li.quest/v1/status. Used by the deposit flow to poll the
// status of a cross-chain bridge hop after the source tx has been
// mined, until LI.FI confirms it has been delivered on the
// destination chain.
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!LIFI_API_KEY) {
    console.error("[tx-status] LIFI_API_KEY not configured");
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const out = new URLSearchParams();
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (!STATUS_QUERY_ALLOWLIST.has(key)) continue;
    if (value.length > 128) continue;
    out.set(key, value);
  }

  if (!out.get("txHash")) {
    return NextResponse.json(
      { message: "Missing txHash" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const upstream = await fetch(
      `${LIFI_API_BASE}/v1/status?${out.toString()}`,
      {
        headers: { "x-lifi-api-key": LIFI_API_KEY },
        cache: "no-store",
        signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
      }
    );

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.error(
        `[tx-status] upstream ${upstream.status}: ${text.slice(0, 500)}`
      );
      return NextResponse.json(
        { message: "Failed to fetch status" },
        { status: upstream.status >= 500 ? 502 : 400, headers: NO_STORE_HEADERS }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[tx-status] network error", err);
    return NextResponse.json(
      { message: "Network error fetching status" },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }
}
