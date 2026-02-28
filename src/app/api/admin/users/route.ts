import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-data";

type ListUsersResponse = Awaited<ReturnType<(typeof supabaseAdmin)["auth"]["admin"]["listUsers"]>>;

interface Profile {
  id: string;
  role: string;
  is_suspended: boolean;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    limit: 50
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const retrievedUsers = data?.users ?? [];
  const profileIds = retrievedUsers.map((user) => user.id);
  let profiles: Profile[] = [];
  if (profileIds.length) {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_suspended")
      .in("id", profileIds)
      .limit(100);
    profiles = (profileData as Profile[]) ?? [];
  }

  const profileMap = new Map<string, Profile>(profiles?.map((profile) => [profile.id, profile]) ?? []);

  const users = retrievedUsers.map((user) => {
    const profile = profileMap.get(user.id);
    return {
      id: user.id,
      email: user.email,
      role: profile?.role ?? "player",
      isSuspended: Boolean(profile?.is_suspended),
      createdAt: user.created_at,
      metadata: { app: user.app_metadata ?? {}, user: user.user_metadata ?? {} }
    };
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const userId = payload.userId as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof payload.role === "string" && payload.role.length) {
    updates.role = payload.role;
  }
  if (payload.isSuspended !== undefined) {
    updates.is_suspended = Boolean(payload.isSuspended);
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id, role, is_suspended")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actionType: "user_update",
    description: `Updated ${userId} (${admin.user.email})`,
    createdBy: admin.user.id,
    details: { updates }
  });

  return NextResponse.json({ updated: data });
}
