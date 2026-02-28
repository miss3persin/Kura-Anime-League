-- Tracks rate-limit observations for AniList/Kitsu so we can monitor when we are approaching budgets.

CREATE TABLE IF NOT EXISTS public.api_rate_limit_logs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status INTEGER NOT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,

  rate_limit INTEGER,
  rate_remaining INTEGER,
  rate_reset_at TIMESTAMPTZ,

  bucket TEXT,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_logs_source 
  ON public.api_rate_limit_logs(source);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_logs_endpoint 
  ON public.api_rate_limit_logs(endpoint);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_logs_recorded_at 
  ON public.api_rate_limit_logs(recorded_at DESC);