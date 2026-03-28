-- Seed data that configures default admin content blocks used by the UI.
INSERT INTO public.admin_content (key, value)
VALUES
  (
    'hero_banner',
    '{"visible": true, "headline": "KAL Spring 2026", "subtitle": "The new season starts April 1, 2026", "cta": "View draft", "ctaLink": "/draft"}'
  ),
  (
    'admin_display_config',
    '{"show_real_time_timeline": true, "show_trending_highlights": true, "show_market_pulse": true, "show_playbook": true, "show_leaderboard_preview": true, "show_season_timeline": true, "disable_welcome_modal": false}'
  ),
  (
    'site_announcement',
    '{"visible": false, "message": "", "ctaLabel": "", "ctaLink": ""}'
  ),
  (
    'leveling_config',
    '{"base_kp":1500,"growth_rate":1.18}'
  )
ON CONFLICT (key) DO NOTHING;

