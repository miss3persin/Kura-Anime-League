import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-data";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("polls")
    .select("id, question, option_a, option_b, votes_a, votes_b, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ polls: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const question = (payload.question ?? "").toString().trim();
  const optionA = (payload.optionA ?? "").toString().trim();
  const optionB = (payload.optionB ?? "").toString().trim();
  const isActive = Boolean(payload.isActive ?? true);

  if (!question || !optionA || !optionB) {
    return NextResponse.json({ error: "Question and both options are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("polls")
    .insert({
      question,
      option_a: optionA,
      option_b: optionB,
      is_active: isActive
    })
    .select("id, question, option_a, option_b, votes_a, votes_b, is_active, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actionType: "poll_create",
    description: `Poll "${question}" created by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: { poll: data }
  });

  return NextResponse.json({ poll: data });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const pollId = payload.pollId;
  if (!pollId) {
    return NextResponse.json({ error: "Missing pollId" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof payload.question === "string" && payload.question.length) {
    updates.question = payload.question.trim();
  }
  if (typeof payload.optionA === "string" && payload.optionA.length) {
    updates.option_a = payload.optionA.trim();
  }
  if (typeof payload.optionB === "string" && payload.optionB.length) {
    updates.option_b = payload.optionB.trim();
  }
  if (payload.isActive !== undefined) {
    updates.is_active = Boolean(payload.isActive);
  }
  if (payload.resetVotes) {
    updates.votes_a = 0;
    updates.votes_b = 0;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("polls")
    .update(updates)
    .eq("id", pollId)
    .select("id, question, option_a, option_b, votes_a, votes_b, is_active, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actionType: "poll_update",
    description: `Poll ${pollId} updated by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: { poll: data }
  });

  return NextResponse.json({ poll: data });
}
