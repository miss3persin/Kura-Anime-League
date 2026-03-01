# Database Migration & Workflow Guide

This document combines the release notes, manual instructions, and workflow rules that govern every Supabase schema change for Kura Anime League (KAL). The remote Supabase database is treated as production-grade, so every migration, seed, or helper must be applied manually and verified before deployment.

## Migrations (chronological)
1. **20260227180000_init_schema.sql – Core profile/season/team schema**
   - Creates `profiles`, `seasons`, `anime_cache`, `anime_history`, `teams`, `team_picks`, `polls`, `admin_content`, and `admin_action_logs`.
   - Adds the foundational indexes, RLS policies, and the trigger-function that seeds profiles on auth signup.

2. **20260227182000_phase2_league_features.sql – Competition/leagues layer**
   - Alters `teams` for captain/vice-captain tracking, transfer metrics, and weekly scoring markers.
   - Introduces `leagues`, `league_members`, `transfers`, `weekly_scores`, `matchups`, and `predictions`.

3. **20260227184000_season_loop.sql – UUID seasons + hype/score framework**
   - Drops/rebuilds `seasons`, `hype_history`, `season_scores`, and `carry_over_picks` to switch to UUID primary keys.
   - Adds RLS policies plus stored procedures (`upsert_season_kp`, `award_season_badges`).

4. **20260227190000_anime_hype_sync.sql – Hype tracking extensions**
   - Adds `hype_score`, `hype_change`, `status`, and `hype_history` JSON columns to `anime_cache`.

5. **20260227191000_util_functions.sql – Utility helpers**
   - Defines `public.increment_kp` and enforces a `profiles.total_kp` default of 20,000.

6. **20260228125000_anime_identity_map.sql – Cross-API Mapping**
   - Creates `anime_identity_map` to store linked IDs for AniList, MAL, Kitsu, and TMDB.
   - Enables reliable fallbacks and data enrichment from multiple sources.

7. **20260228183000_create_character_cache.sql – Character Drafting**
   - Creates `character_cache` to store seasonal Waifus and Husbandos.
   - Includes fields for `role`, `image`, and AniList `id`.

8. **20260228210000_enhance_characters.sql – Recruitment Meta**
   - Adds `gender`, `price` (KP), `favorites`, and `about` (bio) to characters.
   - Implements ONA eligibility hotfixes.

9. **20260301000000_add_character_age.sql – Eligibility Rules**
   - Adds `age` column to `character_cache`.
   - Supports the strict 16+ recruitment rule for Waifus and Husbandos.

## Workflow Rules & Best Practices
- **Lazy Initialization:** Use `getSupabaseAdmin()` or the `supabaseAdmin` proxy in `src/lib/supabase/admin.ts` for scripts. This prevents crashes if environment variables aren't loaded at import time.
- **Script Env Loading:** Always use `import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd());` at the top of standalone scripts (e.g., `trigger-sync.ts`).
- **High-Res Strategy:** Prefer `extraLarge` URLs for `cover_image`. If a migration or sync adds `medium` or `large`, run the force-upgrade script to keep the UI sharp.
- **UUID vs Integer:** All seasonal queries must use `season_uuid`. The legacy `season_id` column is deprecated for join logic.

## Manual Review Notes
- **Character Bio Scrubbing:** The UI applies regex scrubbing to character bios to remove AniList markdown (`__`, `~~`, `||`). Ensure the `about` column in the DB remains the "raw" source from the API.
- **Market Pulse:** Unlike the rest of the homepage, the Market Pulse query should always be a mix of `active` and `upcoming` seasons.
