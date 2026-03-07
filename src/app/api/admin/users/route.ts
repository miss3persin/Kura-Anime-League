import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-data";
import {
  getAdminAccessConfig,
  normalizeEmail,
  removeAdminAccessGrant,
  upsertAdminAccessGrant,
} from "@/lib/admin-access";

const getUserRole = (user: { app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null }) => {
  const appRole = user.app_metadata?.role;
  if (typeof appRole === "string" && appRole.length > 0) {
    return appRole.toLowerCase();
  }

  const userRole = user.user_metadata?.role;
  if (typeof userRole === "string" && userRole.length > 0) {
    return userRole.toLowerCase();
  }

  return "player";
};

const parseTotalKp = (value: unknown, fallback = 20000) => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.round(value));
};

const syncUserRole = async (userId: string, role: string) => {
  const { data: existingUserData, error: existingUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (existingUserError || !existingUserData?.user) {
    throw new Error(existingUserError?.message ?? "User not found");
  }

  const existingUser = existingUserData.user;
  const nextAppMetadata = {
    ...(existingUser.app_metadata ?? {}),
    role
  };

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: nextAppMetadata
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to update auth role");
  }

  return data.user;
};

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const [{ data, error }, accessConfig] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
    getAdminAccessConfig()
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const retrievedUsers = data?.users ?? [];
  const userIds = retrievedUsers.map((user) => user.id);
  const profilesById = new Map<string, { username: string | null; total_kp: number | null; role: string | null; is_suspended: boolean | null }>();

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, username, total_kp, role, is_suspended")
      .in("id", userIds);

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, profile);
    }
  }

  const users = retrievedUsers.map((user) => {
    const profile = profilesById.get(user.id);
    const grant = accessConfig.grants.find((entry) => entry.email === normalizeEmail(user.email ?? ""));
    const role = profile?.role ?? getUserRole(user) ?? grant?.role ?? "player";
    const totalKp = profile?.total_kp ?? grant?.totalKp ?? 20000;
    const isSuspended = profile?.is_suspended ?? grant?.isSuspended ?? false;

    return {
      id: user.id,
      email: user.email,
      username: profile?.username ?? null,
      role,
      totalKp,
      isSuspended,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null
    };
  });

  return NextResponse.json({
    users,
    grants: accessConfig.grants
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "update_user";

  if (action === "grant_access") {
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const role = typeof payload.role === "string" && payload.role.trim() ? payload.role.trim().toLowerCase() : "player";
    const totalKp = parseTotalKp(payload.totalKp, 20000);
    const isSuspended = Boolean(payload.isSuspended);

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    await upsertAdminAccessGrant({ email, role, totalKp, isSuspended });

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const matchedUser = (authUsers?.users ?? []).find((entry) => normalizeEmail(entry.email ?? "") === email);

    if (matchedUser) {
      await syncUserRole(matchedUser.id, role);
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          role,
          total_kp: totalKp,
          is_suspended: isSuspended
        })
        .eq("id", matchedUser.id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }

    await logAdminAction({
      actionType: "admin_access_grant",
      description: `Access defaults updated for ${email} by ${admin.user.email}`,
      createdBy: admin.user.id,
      details: { email, role, totalKp, isSuspended }
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "remove_grant") {
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    await removeAdminAccessGrant(email);

    await logAdminAction({
      actionType: "admin_access_remove",
      description: `Access defaults removed for ${email} by ${admin.user.email}`,
      createdBy: admin.user.id,
      details: { email }
    });

    return NextResponse.json({ ok: true });
  }

  const userId = payload.userId as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const role = typeof payload.role === "string" && payload.role.trim() ? payload.role.trim().toLowerCase() : "player";
  const totalKp = parseTotalKp(payload.totalKp, 20000);
  const isSuspended = Boolean(payload.isSuspended);

  let updatedUser;
  try {
    updatedUser = await syncUserRole(userId, role);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update auth role";
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      role,
      total_kp: totalKp,
      is_suspended: isSuspended
    })
    .eq("id", userId)
    .select("id, username, total_kp, role, is_suspended")
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (updatedUser.email) {
    await upsertAdminAccessGrant({
      email: normalizeEmail(updatedUser.email),
      role,
      totalKp,
      isSuspended
    });
  }

  await logAdminAction({
    actionType: "user_update",
    description: `Updated ${updatedUser.email ?? userId} by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: { userId, role, totalKp, isSuspended }
  });

  return NextResponse.json({
    updated: {
      id: updatedUser.id,
      email: updatedUser.email,
      username: profile?.username ?? null,
      role: profile?.role ?? role,
      totalKp: profile?.total_kp ?? totalKp,
      isSuspended: profile?.is_suspended ?? isSuspended
    }
  });
}
