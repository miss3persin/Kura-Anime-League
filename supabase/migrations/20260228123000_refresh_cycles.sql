-- Tracks each manual or scheduled refresh cycle so we can surface last run times without relying on Cron.

CREATE TABLE IF NOT EXISTS public.refresh_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  initiated_by TEXT,
  started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMPTZ,
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_refresh_cycles_started_at ON public.refresh_cycles(started_at DESC);
