import { NextResponse } from "next/server";
import { syncHypeMarket } from "@/lib/server/hype-sync";
import { requireServiceSecret } from "@/lib/service-auth";

const CACHE_HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0" };
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireServiceSecret(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await syncHypeMarket();
    return NextResponse.json({ success: true, ...result }, { headers: CACHE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500, headers: CACHE_HEADERS });
  }
}
