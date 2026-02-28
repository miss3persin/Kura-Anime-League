import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getAdminContent(key: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_content")
    .select("value")
    .eq("key", key)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return data?.value ?? null;
}

export async function upsertAdminContent(key: string, value: unknown) {
  const { error } = await supabaseAdmin
    .from("admin_content")
    .upsert({ key, value }, { onConflict: "key" })
    .select()
    .single();

  if (error) {
    throw error;
  }
}

export async function logAdminAction(options: {
  actionType: string;
  description: string;
  createdBy?: string;
  details?: Record<string, unknown>;
}) {
  const { actionType, description, createdBy, details } = options;
  const { error } = await supabaseAdmin.from("admin_action_logs").insert({
    action_type: actionType,
    description,
    created_by: createdBy ?? null,
    details: details ?? {},
  });
  if (error) {
    console.error("Failed to log admin action", error);
  }
}

export async function fetchRecentAdminLogs(limit = 6) {
  const { data } = await supabaseAdmin
    .from("admin_action_logs")
    .select("id, action_type, description, created_by, created_at, details")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
