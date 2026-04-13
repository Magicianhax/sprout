import { NextRequest, NextResponse } from "next/server";
import {
  API_FETCH_TIMEOUT_MS,
  DEFAULT_SLIPPAGE,
  LIFI_API_BASE,
  MAX_SLIPPAGE,
  QUOTE_API_QUERY_ALLOWLIST,
} from "@/lib/constants";
import { getLifiIntegrator } from "@/lib/lifiIntegrator";

const LIFI_API_KEY = process.env.LIFI_API_KEY;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

const REQUIRED_PARAMS = [
  "fromChain",
  "toChain",
  "fromToken",
  "toToken",
  "fromAmount",
  "fromAddress",
] as const;

function isPositiveIntString(v: string): boolean {
  return /^[1-9]\d*$/.test(v);
}

function isAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

async function validateAndFilterParams(
  input: URLSearchParams
): Promise<
  { ok: true; params: URLSearchParams } | { ok: false; message: string }
> {
  for (const key of REQUIRED_PARAMS) {
    if (!input.get(key)) {
      return { ok: false, message: `Missing required parameter: ${key}` };
    }
  }

  const fromChain = input.get("fromChain")!;
  const toChain = input.get("toChain")!;
  const fromAmount = input.get("fromAmount")!;
  const fromToken = input.get("fromToken")!;
  const toToken = input.get("toToken")!;
  const fromAddress = input.get("fromAddress")!;

  if (!isPositiveIntString(fromChain) || !isPositiveIntString(toChain)) {
    return { ok: false, message: "Invalid chain id" };
  }
  if (!isPositiveIntString(fromAmount)) {
    return { ok: false, message: "Invalid fromAmount" };
  }
  if (!isAddress(fromToken) || !isAddress(toToken) || !isAddress(fromAddress)) {
    return { ok: false, message: "Invalid token or address" };
  }

  const out = new URLSearchParams();
  for (const [key, value] of input.entries()) {
    if (!(QUOTE_API_QUERY_ALLOWLIST as ReadonlySet<string>).has(key)) continue;
    if (value.length > 128) continue;
    out.set(key, value);
  }

  // Cap slippage to defend against client-side bypass. LI.FI accepts
  // slippage as a decimal fraction (0.005 = 0.5%).
  const rawSlippage = out.get("slippage");
  let slippage = DEFAULT_SLIPPAGE;
  if (rawSlippage !== null) {
    const parsed = Number(rawSlippage);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { ok: false, message: "Invalid slippage" };
    }
    slippage = Math.min(parsed, MAX_SLIPPAGE);
  }
  out.set("slippage", String(slippage));

  // Tag every quote with the integrator name registered against
  // our LI.FI API key. Resolved from /v1/keys/test the first time
  // it's needed and cached thereafter — hardcoding it was how we
  // shipped the wrong value ("sprout" vs "sprout_app") and lost
  // fee-share routing. When set, we also charge the 25 bps
  // integrator fee so LI.FI forwards it on-chain via FeeForwarder.
  const integrator = await getLifiIntegrator();
  if (integrator) {
    out.set("integrator", integrator);
    out.set("fee", "0.0025");
  }

  return { ok: true, params: out };
}

export async function GET(request: NextRequest) {
  if (!LIFI_API_KEY) {
    console.error("[quote] LIFI_API_KEY not configured");
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const validated = await validateAndFilterParams(request.nextUrl.searchParams);
  if (!validated.ok) {
    return NextResponse.json(
      { message: validated.message },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const composerUrl = `${LIFI_API_BASE}/v1/quote?${validated.params.toString()}`;

  try {
    const res = await fetch(composerUrl, {
      headers: { "x-lifi-api-key": LIFI_API_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(
        `[quote] upstream ${res.status}: ${errorBody.slice(0, 500)}`
      );
      // Map upstream 4xx to 400 to avoid leaking internal status, 5xx to 502.
      const status = res.status >= 500 ? 502 : 400;
      return NextResponse.json(
        { message: "Failed to get quote" },
        { status, headers: NO_STORE_HEADERS }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[quote] network error", err);
    return NextResponse.json(
      { message: "Network error fetching quote" },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }
}
