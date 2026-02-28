import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ApiRateLimitRecord {
  source: string;
  endpoint: string;
  status: number;
  success: boolean;
  limit?: number;
  remaining?: number;
  resetAt?: string | null;
  bucket?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  recorded_at?: string;
}

export async function logApiRateLimit(record: ApiRateLimitRecord) {
  try {
    await supabaseAdmin
      .from('api_rate_limit_logs')
      .insert(record, { returning: 'minimal' });
  } catch (error) {
    // Avoid failing the requesting flow if logging fails.
    console.warn('Rate limit log failed', error);
  }
}
