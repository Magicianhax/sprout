import { NextRequest } from "next/server";

const EARN_API_BASE = "https://earn.li.fi";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join("/");
  const { searchParams } = request.nextUrl;

  const url = `${EARN_API_BASE}/${apiPath}?${searchParams.toString()}`;

  const res = await fetch(url);

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
