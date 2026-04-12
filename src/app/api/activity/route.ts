import { NextRequest, NextResponse } from "next/server";
import { API_FETCH_TIMEOUT_MS, LIFI_API_BASE } from "@/lib/constants";

const LIFI_API_KEY = process.env.LIFI_API_KEY;

const MAX_LIMIT = 50;

function isAddress(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

function isPositiveInt(v: string, max: number): boolean {
  if (!/^[1-9]\d*$/.test(v)) return false;
  return Number(v) <= max;
}

export async function GET(request: NextRequest) {
  if (!LIFI_API_KEY) {
    console.error("[activity] LIFI_API_KEY not configured");
    return NextResponse.json(
      { message: "Server configuration error" },
      { status: 500 }
    );
  }

  const address = request.nextUrl.searchParams.get("address");
  const limitRaw = request.nextUrl.searchParams.get("limit") ?? "20";

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { message: "Invalid or missing address" },
      { status: 400 }
    );
  }
  if (!isPositiveInt(limitRaw, MAX_LIMIT)) {
    return NextResponse.json({ message: "Invalid limit" }, { status: 400 });
  }

  const upstreamParams = new URLSearchParams({
    fromAddress: address,
    limit: limitRaw,
  });
  const upstreamUrl = `${LIFI_API_BASE}/v2/analytics/transfers?${upstreamParams.toString()}`;

  try {
    const res = await fetch(upstreamUrl, {
      headers: { "x-lifi-api-key": LIFI_API_KEY },
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(
        `[activity] upstream ${res.status}: ${errorBody.slice(0, 500)}`
      );
      const status = res.status >= 500 ? 502 : 400;
      return NextResponse.json(
        { message: "Failed to load activity" },
        { status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[activity] network error", err);
    return NextResponse.json(
      { message: "Network error fetching activity" },
      { status: 502 }
    );
  }
}
