import type { NextRequest } from "next/server";

const LIFI_API_KEY = process.env.LIFI_API_KEY;
const COMPOSER_BASE = "https://li.quest";

export async function GET(request: NextRequest) {
  if (!LIFI_API_KEY) {
    return Response.json({ message: "Server configuration error" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const requiredParams = ["fromChain", "toChain", "fromToken", "toToken", "fromAmount", "fromAddress"];
  for (const param of requiredParams) {
    if (!searchParams.get(param)) {
      return Response.json({ message: `Missing required parameter: ${param}` }, { status: 400 });
    }
  }

  const composerUrl = `${COMPOSER_BASE}/v1/quote?${searchParams.toString()}`;
  const res = await fetch(composerUrl, {
    headers: { "x-lifi-api-key": LIFI_API_KEY },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return Response.json({ message: "Failed to get quote", details: errorBody }, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data);
}
