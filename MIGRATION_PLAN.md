# Migration Plan

This file documents every migration, seed, and archived SQL asset along with manual instructions. The remote Supabase database is considered production; none of these scripts are executed automatically. Follow the workflow below for future work.

## Migrations (in chronological order)

1. **20260227180000_init_schema.sql – Core profile/season/team schema**
   - Creates `profiles`, `seasons`, `anime_cache`, `anime_history`, `teams`, `team_picks`, `polls`, `admin_content`, and `admin_action_logs`.
   - Adds the original indexes, RLS policies, and trigger-function that seeds profiles on auth signup.
   - Dependencies: none. Contains foundational tables and RLS/policies that subsequent migrations rely on.
   - Notes: Idempotent DDL (uses `CREATE TABLE`/`IF NOT EXISTS`). No destructive changes.

2. **20260227182000_phase2_league_features.sql – Competition/leagues layer**
   - Alters `teams` to append captain, vice-captain, transfer metrics, and week tracking.
   - Creates `leagues`, `league_members`, `transfers`, `weekly_scores`, `matchups`, and `predictions`.
   - Applies indexes and refreshes RLS policies for the new tables, dropping and recreating them to ensure idempotence.
   - Dependencies: assumes tables from migration 1 exist. No drops beyond policy resets.

3. **20260227184000_season_loop.sql – UUID seasons + hype/score framework**
   - Drops the legacy `seasons`, `hype_history`, `season_scores`, and `carry_over_picks` tables and rebuilds them using UUID PKs.
   - Updates `teams` and `weekly_scores` to reference the new UUID-based `seasons`, and adds payout/season carry-over helpers.
   - Adds RLS policies and two stored procedures (`upsert_season_kp`, `award_season_badges`) for leaderboard management.
   - Dependencies: relies on `profiles`, `teams`, `weekly_scores` from prior migrations.
   - Manual review note: contains destructive drop/recreate blocks. Back up existing seasons data before running.

4. **20260227190000_anime_hype_sync.sql – Hype tracking extensions**
   - Adds `hype_score`, `hype_change`, `status`, and `hype_history` JSON columns to `anime_cache`.
   - Adds indexes used by `/api/hype` and sync jobs.
   - Dependencies: requires `anime_cache` from migration 1.
   - Idempotent via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

5. **20260227191000_util_functions.sql – Utility helpers**
   - Defines `public.increment_kp` and ensures `profiles.total_kp` defaults to 20,000.
   - Dependencies: `profiles` table from migration 1.

## Seed Files

- **supabase/seed/admin_content.sql**
  - Seeds `admin_content` with the hero banner configuration and display toggles required by the UI.
  - Apply manually **after** the migrations run: `psql "$SUPABASE_DB_URL" -f supabase/seed/admin_content.sql`.
  - Contains a header comment describing its purpose.

## Archived SQL

The following legacy `.sql` files are preserved for context in `supabase/archive_sql/`. None are run directly.

- `supabase_schema.sql`
- `supabase_phase2.sql`
- `supabase_season_loop.sql`
- `supabase_sync_fix_migration.sql`
- `supabase_utils.sql`

Refer to these archives to understand how the migrations were derived. No code from them was deleted; everything redundant was either merged into the migrations above or captured here.

## Workflow Rules (Docker-less remote workflow)

1. **Staging logic**
   - Place new SQL edits into `sql_staging/` (create this directory in the repo root if it doesn’t exist).
   - Turn each logical change into a timestamped migration under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
   - Keep all schema logic inside `supabase/migrations/` and seed data inside `supabase/seed/`.

2. **Manual deployment**
   - Run migrations manually against the production Supabase DB (never `supabase db push` when Docker is absent).
   - Use `psql "$SUPABASE_DB_URL"` (or your preferred DB client) to execute the migration files sequentially.
   - After the migrations, run each seed file similarly via `psql "$SUPABASE_DB_URL" -f supabase/seed/<file>.sql`.

3. **Migration plan updates**
   - After adding or modifying migrations/seeds, update this `MIGRATION_PLAN.md` with the new file’s purpose, dependencies, and any manual notes.
   - Always rerun `supabase db diff --db-url "$SUPABASE_DB_URL"` (or a manual schema comparison) before each deploy to catch drift.

4. **Optional automation**
   - You may script ordered execution using `psql` (e.g., `for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done`), but run it manually and watch for errors. Do not add CLI-level automation that assumes Docker.

## Manual Review Notes

- The season-loop migration drops and recreates `seasons`, `hype_history`, `season_scores`, and `carry_over_picks` to switch to UUIDs. Back up or export production season data before running those statements.
- After migrations, seed `admin_content` via `supabase/seed/admin_content.sql` to ensure default UI blocks exist.
- The remote database is production-grade; never assume it can be reset or recreated. Always run schema changes manually and verify success before continuing.
