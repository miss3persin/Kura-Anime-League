import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

const parseList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const ADMIN_EMAILS = new Set(parseList(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase()));
const ADMIN_IDS = new Set(parseList(process.env.ADMIN_USER_IDS));
const ADMIN_ROLES = new Set(parseList(process.env.ADMIN_ROLES || "admin").map((role) => role.toLowerCase()));

const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  email_confirmed: user.email_confirmed,
  user_metadata: user.user_metadata ?? null
});

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/Bearer\s+/i, "").trim();
  return token || null;
};

const hasAdminRole = (user: User) => {
  const metadataRole =
    (user?.app_metadata?.role ?? user?.user_metadata?.role ?? "")
      .toString()
      .toLowerCase();
  return ADMIN_ROLES.has(metadataRole);
};

export interface AdminSession {
  user: ReturnType<typeof sanitizeUser>;
  rawUser: User;
}

export async function requireAdmin(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = data.user;
  const normalizedEmail = user.email?.toLowerCase();
  const isEmailAdmin = normalizedEmail ? ADMIN_EMAILS.has(normalizedEmail) : false;
  const isIdAdmin = ADMIN_IDS.has(user.id);
  const isRoleAdmin = hasAdminRole(user);

  if (!isEmailAdmin && !isIdAdmin && !isRoleAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    user: sanitizeUser(user),
    rawUser: user
  };
}

export const unauthorizedResponse = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
