import { NextResponse } from "next/server";
import { runRefreshCycle } from "@/lib/refreshCycle";
import { requireServiceSecret } from "@/lib/service-auth";

const CRON_SECRET = process.env.CRON_SECRET;

function hasCronAuth(request: Request) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : null;
    const headerSecret = request.headers.get("x-cron-secret");
    const querySecret = new URL(request.url).searchParams.get("secret");

    return bearer === CRON_SECRET || headerSecret === CRON_SECRET || querySecret === CRON_SECRET;
  }

  return Boolean(request.headers.get("x-vercel-cron"));
}

async function handle(request: Request) {
  if (!hasCronAuth(request)) {
    const unauthorized = requireServiceSecret(request);
    if (unauthorized) {
      return unauthorized;
    }
  }

  const initiator = request.headers.get("x-refresh-initiator") ?? "cron";
  try {
    const result = await runRefreshCycle(initiator);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    console.error("Cron refresh failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
