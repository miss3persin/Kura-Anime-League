import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { fetchRecentAdminLogs } from "@/lib/admin-data";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const logs = await fetchRecentAdminLogs(10);
  return NextResponse.json({ logs });
}
