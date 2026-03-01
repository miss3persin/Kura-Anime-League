# Database Migration & Workflow Guide

This document combines the release notes, manual instructions, and workflow rules that govern every Supabase schema change for Kura Anime League (KAL). The remote Supabase database is treated as production-grade, so every migration, seed, or helper must be applied manually and verified before deployment.

## Migrations (chronological)
1. **20260227180000_init_schema.sql – Core profile/season/team schema**
   - Creates `profiles`, `seasons`, `anime_cache`, `anime_history`, `teams`, `team_picks`, `polls`, `admin_content`, and `admin_action_logs`.
   - Adds the foundational indexes, RLS policies, and the trigger-function that seeds profiles on auth signup.
   - Dependencies: none. Idempotent DDL (`CREATE TABLE IF NOT EXISTS`).

2. **20260227182000_phase2_league_features.sql – Competition/leagues layer**
   - Alters `teams` for captain/vice-captain tracking, transfer metrics, and weekly scoring markers.
   - Introduces `leagues`, `league_members`, `transfers`, `weekly_scores`, `matchups`, and `predictions` along with their indexes and refreshed RLS policies.
   - Dependencies: tables from migration 1. No destructive drops beyond policy refreshes.

3. **20260227184000_season_loop.sql – UUID seasons + hype/score framework**
   - Drops/rebuilds `seasons`, `hype_history`, `season_scores`, and `carry_over_picks` to switch to UUID primary keys.
   - Updates `teams` and `weekly_scores` to reference the new UUID-based `seasons` while adding payout helpers.
   - Adds RLS policies plus stored procedures (`upsert_season_kp`, `award_season_badges`).
   - Dependencies: relies on `profiles`, `teams`, `weekly_scores` from prior migrations.

4. **20260227190000_anime_hype_sync.sql – Hype tracking extensions**
   - Adds `hype_score`, `hype_change`, `status`, and `hype_history` JSON columns to `anime_cache` plus supporting indexes.
   - Hooked up to `/api/hype` and the sync jobs for the pricing panel.
   - Idempotent via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

5. **20260227191000_util_functions.sql – Utility helpers**
   - Defines `public.increment_kp` and enforces a `profiles.total_kp` default of 20,000.
   - Dependencies: `profiles` table installed by migration 1.

## Seeds & Archived SQL
- **`supabase/seed/admin_content.sql`**: seeds `admin_content` with the hero banner, announcements, and display toggles that the UI expects. Run it with `psql "$SUPABASE_DB_URL" -f supabase/seed/admin_content.sql` after the migrations.
- **Archived SQL**: keep `supabase_schema.sql`, `supabase_phase2.sql`, `supabase_season_loop.sql`, `supabase_sync_fix_migration.sql`, and `supabase_utils.sql` in `supabase/archive_sql/` for historical reference.

## Workflow
### 1. Staging & migration creation
- Stage every schema change inside `sql_staging/` before turning it into a timestamped file under `supabase/migrations/YYYYMMDDHHMMSS_<short-name>.sql`.
- Keep schema logic inside `supabase/migrations/` and seed data inside `supabase/seed/`. Each migration should tackle a single logical change and avoid destructive operations unless absolutely necessary—call them out with inline comments when you do.
- Run `supabase migration new <short-description>` (with the Supabase CLI) to bootstrap new migrations.

### 2. Local application & validation
- Start from a clean dev database and run `supabase db reset --force --project-ref ginulfnipylayhsxcmzh`. This recreates the database and clears data.
- Apply every migration with `supabase db push --project-ref ginulfnipylayhsxcmzh`.
- Use `supabase db diff origin/main --project-ref ginulfnipylayhsxcmzh` (or a manual schema comparison) whenever you need to verify pending changes against an existing remote before pushing anything new.

### 3. Remote deployment
- After the diff looks good, run `supabase db push --project-ref ginulfnipylayhsxcmzh` again so the remote schema matches the local one.
- If you added seed files under `supabase/seed/`, execute them separately via `supabase db run supabase/seed/<file>.sql` or your chosen deployment process immediately after `db push`.

### 4. Rollbacks & emergencies
- Supabase migrations are append-only. To reverse a change, revert the offending migration file in Git, rerun `supabase db reset --force` locally, and replay `supabase db push`.
- Never delete or directly edit migrations that already ran in production. Instead, issue a corrective migration that undoes the undesired behavior.

### 5. Remote safety checks & optional automation
- Before every deployment, run `supabase db diff --project-ref ginulfnipylayhsxcmzh` to ensure no drift exists between your local history and the live database.
- Avoid editing the remote schema directly; always apply schema changes through migrations.
- Optional automation: if needed, script ordered execution (`for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done`) but keep it manual; watch for errors and never assume Docker is available.

## Manual Review Notes
- The `season_loop` migration drops and rebuilds `seasons`, `hype_history`, `season_scores`, and `carry_over_picks` to switch to UUIDs. Back up or export production season data before running those statements.
- After running all migrations, seed `admin_content` via `supabase/seed/admin_content.sql` so the default UI blocks exist.
- Treat the remote database as production-grade: never assume it can be reset or recreated, and always verify success manually before continuing.
