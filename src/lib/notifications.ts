import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type NotificationChannel = "push" | "email" | "system";

export type NotificationInsert = {
  user_id: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  kp_delta?: number | null;
  metadata?: Record<string, unknown>;
};

const toRow = (input: NotificationInsert) => ({
  user_id: input.user_id,
  channel: input.channel,
  title: input.title,
  body: input.body,
  kp_delta: input.kp_delta ?? null,
  metadata: input.metadata ?? {},
});

export async function createNotification(input: NotificationInsert) {
  const { error } = await supabaseAdmin.from("notifications").insert(toRow(input));
  if (error) {
    console.warn("Notification insert failed", error);
  }
}

export async function createNotifications(inputs: NotificationInsert[]) {
  if (!inputs.length) return;
  const rows = inputs.map(toRow);
  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) {
    console.warn("Notifications insert failed", error);
  }
}

export async function broadcastSystemNotification(payload: {
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_suspended", false);

  if (error) {
    console.warn("Notification broadcast failed to load profiles", error);
    return;
  }

  const rows = (profiles ?? []).map((profile) => ({
    user_id: profile.id as string,
    channel: "system" as const,
    title: payload.title,
    body: payload.body,
    kp_delta: null,
    metadata: payload.metadata ?? {},
  }));

  if (!rows.length) return;
  const { error: insertError } = await supabaseAdmin.from("notifications").insert(rows);
  if (insertError) {
    console.warn("Notification broadcast insert failed", insertError);
  }
}
