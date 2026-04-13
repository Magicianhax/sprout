import { NextRequest, NextResponse } from "next/server";
import {
  API_FETCH_TIMEOUT_MS,
  DEFAULT_SLIPPAGE,
  LIFI_API_BASE,
  MAX_SLIPPAGE,
} from "@/lib/constants";
import { getLifiIntegrator } from "@/lib/lifiIntegrator";

const LIFI_API_KEY = process.env.LIFI_API_KEY;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

function isAddress(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
}

function isPositiveIntString(v: unknown): v is string {
  return typeof v === "string" && /^[1-9]\d*$/.test(v);
}

// POST /api/routes — thin proxy to li.quest/v1/advanced/routes that
// injects integrator + slippage + api key server-side so none of them
// can be spoofed by the client. Matches the request shape documented
// at https://docs.li.fi/api-reference/advanced/get-a-set-of-routes-for-a-request-that-describes-a-transfer-of-tokens
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!LIFI_API_KEY) {
    console.error("[routes] LIFI_API_KEY not configured");
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { message: "Invalid body" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const {
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromAddress,
    toAddress,
    slippage: rawSlippage,
  } = body as Record<string, unknown>;

  if (
    typeof fromChainId !== "number" ||
    typeof toChainId !== "number" ||
    !isAddress(fromTokenAddress) ||
    !isAddress(toTokenAddress) ||
    !isPositiveIntString(fromAmount) ||
    !isAddress(fromAddress)
  ) {
    return NextResponse.json(
      { message: "Invalid route parameters" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let slippage = DEFAULT_SLIPPAGE;
  if (typeof rawSlippage === "number" && Number.isFinite(rawSlippage) && rawSlippage > 0) {
    slippage = Math.min(rawSlippage, MAX_SLIPPAGE);
  }

  // Look up the integrator name from the API key itself. LI.FI's
  // fee-share only fires when the integrator here matches what's
  // registered on the key in the Partner Portal — a mismatch
  // silently drops the fee with no error. `getLifiIntegrator` hits
  // /v1/keys/test on first use and caches the name, so there's no
  // per-request overhead after cold start.
  const integrator = await getLifiIntegrator();

  const payload: Record<string, unknown> = {
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromAddress,
    toAddress: isAddress(toAddress) ? toAddress : fromAddress,
    options: {
      ...(integrator ? { integrator } : {}),
      // 25 bps integrator fee — the cap LI.FI allows. Only applied
      // when we have a resolved integrator name; otherwise LI.FI
      // would route the fee to a null recipient.
      ...(integrator ? { fee: 0.0025 } : {}),
      slippage,
      order: "CHEAPEST",
      allowSwitchChain: true,
      // Let LI.FI collapse bridge+deposit into one tx when the route
      // bridge supports it; otherwise it returns multi-step routes.
      allowDestinationCall: true,
    },
  };

  try {
    const upstream = await fetch(`${LIFI_API_BASE}/v1/advanced/routes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lifi-api-key": LIFI_API_KEY,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.error(`[routes] upstream ${upstream.status}: ${text.slice(0, 500)}`);
      return NextResponse.json(
        { message: "Failed to fetch routes" },
        { status: upstream.status >= 500 ? 502 : 400, headers: NO_STORE_HEADERS }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[routes] network error", err);
    return NextResponse.json(
      { message: "Network error fetching routes" },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }
}
