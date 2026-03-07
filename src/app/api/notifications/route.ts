import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

type NotificationChannel = 'push' | 'email' | 'system';

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  channel: string | null;
  kp_delta: number | null;
  is_read: boolean;
  inserted_at: string;
};

const unauthorized = (message = 'Unauthorized') =>
  NextResponse.json({ error: message }, { status: 401 });

const getBearerToken = (request: Request) => {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/Bearer\s+/i, '').trim();
  return token || null;
};

const requireUser = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }

  return data.user;
};

const isNotificationChannel = (value: unknown): value is NotificationChannel =>
  value === 'push' || value === 'email' || value === 'system';

const normalizeNotifications = (rows: NotificationRow[]) =>
  rows
    .filter((row): row is NotificationRow & { channel: NotificationChannel } => isNotificationChannel(row.channel))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      channel: row.channel,
      kpDelta: row.kp_delta ?? undefined,
      timestamp: row.inserted_at,
      read: row.is_read
    }));

const fetchPreferences = async (userId: string) => {
  const { data } = await supabaseAdmin
    .from('notification_preferences')
    .select('push_enabled, email_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    push_enabled: data?.push_enabled ?? true,
    email_enabled: data?.email_enabled ?? true
  };
};

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const { data: notificationsData } = await supabaseAdmin
      .from('notifications')
      .select('id, title, body, channel, kp_delta, is_read, inserted_at')
      .eq('user_id', user.id)
      .order('inserted_at', { ascending: false })
      .limit(20);

    const notifications = notificationsData
      ? normalizeNotifications(notificationsData as NotificationRow[])
      : [];
    const preferences = await fetchPreferences(user.id);

    return NextResponse.json({ notifications, preferences });
  } catch (error: unknown) {
    console.error('Notifications GET failed', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load notifications' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const payload = await request.json().catch(() => ({}));
    const updates: { push_enabled?: boolean; email_enabled?: boolean } = {};

    if (typeof payload.pushEnabled === 'boolean') {
      updates.push_enabled = payload.pushEnabled;
    }
    if (typeof payload.emailEnabled === 'boolean') {
      updates.email_enabled = payload.emailEnabled;
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select();
    }

    if (payload.markAllRead) {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    }

    const preferences = await fetchPreferences(user.id);
    return NextResponse.json({ success: true, preferences });
  } catch (error: unknown) {
    console.error('Notifications PATCH failed', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorized();
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update notifications' }, { status: 500 });
  }
}
