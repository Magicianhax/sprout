import { NextRequest } from "next/server";

const EARN_API_BASE = "https://earn.li.fi";
const LIFI_API_KEY = process.env.LIFI_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join("/");
  const { searchParams } = request.nextUrl;

  const url = `${EARN_API_BASE}/${apiPath}?${searchParams.toString()}`;

  const headers: Record<string, string> = {};
  if (LIFI_API_KEY) {
    headers["x-lifi-api-key"] = LIFI_API_KEY;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errorBody = await res.text();
    return Response.json(
      { message: "Earn API error", details: errorBody },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json(data);
}
