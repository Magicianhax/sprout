import { NextRequest, NextResponse } from "next/server";
import { API_FETCH_TIMEOUT_MS, LIFI_API_BASE } from "@/lib/constants";

const LIFI_API_KEY = process.env.LIFI_API_KEY;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

// POST /api/step-transaction — proxy to li.quest/v1/advanced/stepTransaction.
// The client passes a full LI.FI Step object (from /api/routes) and
// gets back the same step enriched with an executable
// `transactionRequest`. Used to refresh calldata between multi-step
// route hops where the next step depends on the previous one's output.
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!LIFI_API_KEY) {
    console.error("[step-transaction] LIFI_API_KEY not configured");
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

  try {
    const upstream = await fetch(
      `${LIFI_API_BASE}/v1/advanced/stepTransaction`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lifi-api-key": LIFI_API_KEY,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
      }
    );

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.error(
        `[step-transaction] upstream ${upstream.status}: ${text.slice(0, 500)}`
      );
      return NextResponse.json(
        { message: "Failed to populate step transaction" },
        { status: upstream.status >= 500 ? 502 : 400, headers: NO_STORE_HEADERS }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[step-transaction] network error", err);
    return NextResponse.json(
      { message: "Network error populating step" },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }
}
