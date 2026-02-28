import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { serviceFetch } from "@/lib/service-client";
import { logAdminAction } from "@/lib/admin-data";

const UPDATABLE_FIELDS = [
  "draft_opens_at",
  "draft_closes_at",
  "start_date",
  "end_date",
  "transfer_review_ends_at"
] as const;

const toISO = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { data: seasons, error } = await supabaseAdmin
    .from("seasons")
    .select(
      [
        "id",
        "name",
        "status",
        "draft_opens_at",
        "draft_closes_at",
        "start_date",
        "end_date",
        "transfer_review_ends_at",
        "week_number",
        "total_weeks",
        "created_at",
        "updated_at"
      ].join(",")
    )
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seasons: seasons ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const action = (payload.action as string) ?? "manage";

    if (action === "manage") {
      const { nextSeasonName } = payload;
      const res = await serviceFetch("/api/season/manage", {
        method: "POST",
        body: JSON.stringify({ nextSeasonName })
      });
      const results = await res.json().catch(() => ({}));

      if (!res.ok) {
        return NextResponse.json(
          { error: results?.error ?? "Season automation failed" },
          { status: res.status || 500 }
        );
      }

      await logAdminAction({
        actionType: "season_manage",
        description: `Season automation triggered by ${admin.user.email}`,
        createdBy: admin.user.id,
        details: { nextSeasonName, actions: results?.actions ?? [] }
      });

      return NextResponse.json({ result: results });
    }

  if (action === "update") {
    const seasonId = payload.seasonId;
    if (!seasonId) {
      return NextResponse.json({ error: "Missing seasonId" }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    for (const field of UPDATABLE_FIELDS) {
      const value = payload.fields?.[field];
      const iso = toISO(value);
      if (iso) {
        updates[field] = iso;
      }
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No valid date fields provided" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("seasons")
      .update(updates)
      .eq("id", seasonId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAdminAction({
      actionType: "season_update",
      description: `Season ${seasonId} dates updated by ${admin.user.email}`,
      createdBy: admin.user.id,
      details: { updates, seasonId }
    });

    return NextResponse.json({ updated: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
