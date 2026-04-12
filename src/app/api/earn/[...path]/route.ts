import { NextRequest, NextResponse } from "next/server";
import {
  API_FETCH_TIMEOUT_MS,
  EARN_API_BASE,
  EARN_API_PATH_ALLOWLIST,
  EARN_API_QUERY_ALLOWLIST,
} from "@/lib/constants";

const LIFI_API_KEY = process.env.LIFI_API_KEY;

// Proxy is always live — every call hits the upstream. Without this
// Next can treat the route as static and the browser can cache GETs
// across calls, which means post-deposit invalidations return old
// data until a hard reload.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, must-revalidate",
};

function isAllowedPath(path: string): boolean {
  return EARN_API_PATH_ALLOWLIST.some((re) => re.test(path));
}

function filterQuery(input: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of input.entries()) {
    if (
      (EARN_API_QUERY_ALLOWLIST as ReadonlySet<string>).has(key) &&
      value.length <= 256
    ) {
      out.set(key, value);
    }
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.map((seg) => encodeURIComponent(seg)).join("/");

  if (!isAllowedPath(path.join("/"))) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const safeQuery = filterQuery(request.nextUrl.searchParams);
  const url = `${EARN_API_BASE}/${apiPath}${
    safeQuery.toString() ? `?${safeQuery.toString()}` : ""
  }`;

  const headers: Record<string, string> = {};
  if (LIFI_API_KEY) {
    headers["x-lifi-api-key"] = LIFI_API_KEY;
  }

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Don't echo the upstream body to the client — it can include
      // internal hostnames or stack traces. Log it server-side and
      // return a generic message.
      const errorBody = await res.text().catch(() => "");
      console.error(
        `[earn proxy] upstream ${res.status} for ${apiPath}: ${errorBody.slice(0, 500)}`
      );
      return NextResponse.json(
        { message: "Earn API error" },
        { status: res.status >= 500 ? 502 : res.status, headers: NO_STORE_HEADERS }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error(`[earn proxy] ${apiPath}`, err);
    return NextResponse.json(
      { message: "Upstream unavailable" },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  }
}
