# Database Migration & Workflow Guide

This guide tracks the Supabase schema history, the rules that keep production safe, and the operational touchpoints that power the Kura Anime League (KAL) platform. The hosted Supabase instance is treated as production-grade: schema changes are append-only, migrations are the only path for structural updates, and every deployed environment must honor the same triggers, RPCs, and RLS policies described below.

## Principles
- **Supabase-first:** All tables live in the `public` schema, and every row-level security policy is intentionally scoped (see the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` lines sprinkled through the migrations). Never bypass policies by editing the hosted schema directly—always push migrations via the Supabase CLI.
- **Service-driven automation:** `SERVICE_ROUTE_SECRET` guards `/api/sync/refresh` and `/api/hype/refresh`, while Supabase service role credentials reside in `SUPABASE_SERVICE_ROLE_KEY`. RPCs such as `perform_transfer` and `place_prediction_bet` execute with `SECURITY DEFINER` so the UI can keep operations atomic without exposing elevated keys.
- **Migration hygiene:** Every schema change gets its own timestamped file under `supabase/migrations/*.sql`. Columns are added with `ADD COLUMN IF NOT EXISTS`, new tables honor RLS, and indexes follow each bill so API endpoints stay performant.

## Migration Timeline
1. **`20260227180000_init_schema.sql`** – seeds the core tables: `profiles`, `seasons`, `anime_cache`, `anime_history`, `teams`, `team_picks`, `polls`, `admin_content`, and `admin_action_logs`. It also enables RLS policies for these tables, creates the initial `handle_new_user` trigger, and defaulted `total_kp` to 20,000.
2. **`20260227182000_phase2_league_features.sql`** – introduces `leagues`, `league_members`, `transfers`, `weekly_scores`, `matchups`, and `predictions`; adds tactical columns to `teams` (captain/vice captain, transfer counters); and rebuilds RLS/indexes for the competition tables.
3. **`20260227184000_season_loop.sql`** – migrates seasons to UUIDs, adds season phases/phase tracking (`seasons` now stores draft dates, transfer review windows, week counts), creates `hype_history`, `season_scores`, `season_payouts`, `carry_over_picks`, `upsert_season_kp`, and `award_season_badges`, and tightens post-season policies.
4. **`20260227190000_anime_hype_sync.sql`** – extends `anime_cache` with `hype_score`, `hype_change`, `status`, `hype_history`, and supporting indexes used by `/api/hype/refresh` and `syncHypeMarket`.
5. **`20260227191000_util_functions.sql`** – adds shared helpers like `public.increment_kp` and reinforces the 20,000 KP default on `profiles.total_kp`.
6. **`20260228121000_anime_kitsu_mapping.sql`** – preps for Kitsu mappings by ensuring the necessary structures exist before we backfill with Offline map.
7. **`20260228122000_api_rate_limit_logs.sql`** – creates `api_rate_limit_logs` to capture AniList/Kitsu headers so refresh jobs can surface how close we are to rate limits.
8. **`20260228123000_refresh_cycles.sql`** – tracks each manual/scheduled refresh (`runRefreshCycle`) so operations can query the last successful run.
9. **`20260228124000_livechart_breaks.sql`** – stores LiveChart overrides so we can mark shows on break without hitting AniList.
10. **`20260228125000_anime_identity_map.sql`** – maps AniList IDs to MAL/Kitsu and caches metadata used during sync and fallback lookups.
11. **`20260228150000_arc_tracker_achievements.sql`** – adds `current_arc` metadata, the `achievements` table, `user_achievements`, and `weekly_scores.score_modifiers` plus RLS for achievements.
12. **`20260228174500_add_anime_cache_columns.sql`** – necessary tweaks to support additional metadata (e.g., `external_banner_url`).
13. **Character- & character-pick-related migrations (20260228183000 – 20260228210000)** – introduce `character_cache`, `character_picks`, TMDB banner support, `age`, and price history tracking required by the draft experience.
14. **`20260301010000_notifications.sql`** – creates `notifications` and `notification_preferences` so the UI has both history and channel preferences.
15. **`20260307190000_update_tier_system.sql`** – reconfigures badge tiers and ties `award_season_badges` to the refreshed ladder.
16. **`20260307191000_create_perform_transfer_rpc.sql`** – defines the transfer RPC that keeps `team_picks`, `teams`, and `transfers` in sync atomically.
17. **`20260307192000_create_place_prediction_bet_rpc.sql`** – ensures prediction wagers deduct KP and register predictions in one transaction.
18. **`20260307200000_align_predictions_to_uuid_seasons.sql`** – migrates `predictions.season_id` to UUID, recreates constraints/indexes, and refreshes the `place_prediction_bet` RPC to new schema.
19. **`20260307213000_add_character_price_history.sql`** – adds `price_change`/`price_history` to `character_cache` for the draft market graphs.
20. **`20260307223000_admin_access_defaults.sql`** – seeds `admin_access_config` (Victor’s grant with 700K KP), ensures `profiles.role/is_suspended`, and rewrites `handle_new_user` to honor database-stored admin grants.
21. **`20260307233000_prediction_events_admin.sql`** – builds `prediction_events`, connects them to `predictions`, and adds policies/triggers for editable deadlines.

## Table Overviews

### Player & Account
- **`profiles`:** Stores the player record (id, username, avatar, level, total_kp default 20,000, tier, role, `is_suspended`). RLS allows public reads but only the owner can update (`auth.uid() = id`), and `handle_new_user` populates defaults.
- **`auth.users`:** Remains the authentication source of truth. `admin-access` writes roles into `raw_app_meta_data` when a grant requires an admin role.
- **`notifications` + `notification_preferences`:** History of push/email/system notifications plus channel preferences (defaults to `true`). API endpoints expect these columns (e.g., `kp_delta`, `is_read`).
- **`admin_content` & `admin_action_logs`:** Store dynamic UI blocks (`hero_banner`, `site_announcement`, `admin_display_config`, `admin_access_config`) and audit history. The admin dashboard reads/writes these entries and logs each action for transparency.

### Competition Core
- **`seasons`:** UUID-based seasons with draft/transfer dates, `week_number`, and `total_weeks`. Unique indexes enforce only one active season, and `carry_over_picks` tracks which anime each player wants to keep/drop between seasons.
- **`teams` & `team_picks`:** `teams` tie to `profiles` and seasons, holding KP budgets, transfer counters, and captain assignments. `team_picks` stores the anime roster per team. Both tables have RLS that restricts writes to owners.
- **`transfers`:** Logs historical swaps (incoming/outgoing anime, KP cost, week number). `perform_transfer` inserts here inside the RPC defined in migration `20260307191000`.
- **`weekly_scores`, `season_scores`, `season_payouts`:** Score history, leaderboard metadata, and payout records aggregated via `upsert_season_kp`/`award_season_badges`. `weekly_scores` also stores `score_modifiers` after the achievements migration.
- **`matchups` & `leagues`/`league_members`:** League infrastructure with invite codes, `max_members`, public/private flags, and matchup pairings. `league_members` joins players to leagues, while `matchups` tracks home/away scoring.
- **`predictions` & `prediction_events`:** Events (week, anime, prediction type, options) live in `prediction_events`. Each prediction links to an event via `event_id`, enforces `UNIQUE(user_id, event_id)`, and stores KP wagers/results. `place_prediction_bet` protects KP deductions/writes. Prediction events also auto-update their `updated_at` timestamp via `set_prediction_event_updated_at` trigger.

### Market & Hype
- **`anime_cache`:** Canonical cache of each seasonal anime (titles, descriptions, images, `season_id/uuid/name`, `hype_score`, `hype_change`, `cost_kp`, `hype_history`, `status`, `popularity`, `average_score`, `current_arc`, `is_finale_week`, `arc_hype_multiplier`, `external_banner_url`). Refresh jobs upsert this table (via `runRefreshCycle` and `syncHypeMarket`). Indexes exist on hype score, season IDs/UUIDs, and banners.
- **`anime_history` & `hype_history`:** Light-weight, append-only history of price/hype deltas for graphs. `anime_history` stores KPI points/deltas; `hype_history` is season-aware (`anime_id`, `season_id`, `week_number`).
- **`character_cache` & `character_picks`:** Draft character metadata with price, favorites, `price_history`, and computed `price_change`. Characters are labeled as `Waifu`/`Husbando`/`Role`. `character_picks` links teams to characters with `pick_type`, enforces one hero/one waifu per team, and is guarded by RLS policies.
- **`anime_identity_map`, `livechart_breaks`, `api_rate_limit_logs`, `refresh_cycles`:** Identity map connects AniList, Kitsu, and MAL IDs and caches metadata. `livechart_breaks` stores manual overrides for airing status. `api_rate_limit_logs` tracks AniList/Kitsu headers. `refresh_cycles` chronicles background sync attempts.

### Notifications & Achievements
- **`notifications`:** Channels (push/email/system), `kp_delta`, metadata, and `is_read`. Frontend fetches the last 20 rows sorted by `inserted_at`.
- **`notification_preferences`:** Booleans for push/email toggles plus `updated_at`.
- **`achievements` + `user_achievements`:** Achievement definitions with icons/descriptions and many-to-many unlocks. RLS allows everyone to read achievements but only owners to read their unlocks.

### Admin Config
- **`admin_access_config` (stored inside `admin_content.value`):** Holds email-based onboarding defaults (role, KP, suspension). Migration `20260307223000` seeds Victor’s admin grant with 700K KP and rewrites the `handle_new_user` trigger to honor grants, updating `profiles` and `auth.users` when matches occur.
- **`admin_action_logs`:** Audits `action_type`, description, actor, and JSON details for any admin operation exposed via `/api/admin/*`.

## Functions & Triggers
- **`handle_new_user` (migrated in `20260307223000`):** Populates the `profiles` row during signup, applies KP/role overrides from `admin_access_config`, and tags admin metadata into `auth.users`.
- **`upsert_season_kp` & `award_season_badges` (`20260227184000`):** Aggregates season KP per user, rates ranks, updates tier badges, and writes final completion timestamps. `award_season_badges` even updates `profiles.tier`.
- **`perform_transfer` RPC (`20260307191000`)** – deletes the outgoing `team_pick`, inserts the incoming one, updates the KP/transfer counters, and logs the swap inside the same transaction.
- **`place_prediction_bet` RPC (`20260307192000` + `20260307200000`):** Deducts KP, inserts prediction rows, and aborts on unique violations.
- **`set_prediction_event_updated_at` trigger (`20260307233000`):** Keeps `prediction_events.updated_at` truthful for editors.

## Workflow & Maintenance
1. **Create migrations:** Always craft a new SQL file under `supabase/migrations/` (do not edit or delete applied migrations). Name it with the next timestamp and keep each file focused on a single purpose.
2. **Validate locally:** Use `supabase db reset` (if needed) and `supabase db push` to replay the schema, then run `npm run lint`/`npm run test:unit` when schema changes touch TS helpers (such as `calcCostKp` or API routes).
3. **Push remote:** `supabase migration list` or `supabase db push` ensures remote environments receive the same SQL. If remote drift exists, prefer fix-forward migrations (e.g., `ADD COLUMN IF NOT EXISTS` or `CREATE INDEX IF NOT EXISTS`).
4. **Seed defaults:** Run `supabase/seed/admin_content.sql` after migrations to ensure hero/default config values exist.
5. **Verify triggers/RLS:** After each schema change, confirm Supabase policies still allow the intended operations (e.g., `predictions` still restricts writes to logged-in users while admins can still grant access via `/api/admin/users`).

## Refresh & Sync Jobs
- **`runRefreshCycle` (`src/lib/refreshCycle.ts`):** Inserts a `refresh_cycles` record, loops through `determineSeasonContexts`, fetches seasonal data (`fetchSeasonalAnimeList` + `buildAnimeCachePayload`), updates characters, ensures identity mapping (`ensureIdentityMappingForAnime`), requests livechart overrides, and writes status updates back to `refresh_cycles`. TG commands that call `/api/sync/refresh` will trigger this work.
- **`/api/sync/refresh`:** Protected by `SERVICE_ROUTE_SECRET`, it simply invokes `runRefreshCycle`.
- **`supabase/functions/sync-refresh`:** Deno function that forwards requests to `/api/sync/refresh` from a managed scheduler (recommended for pg_cron or Edge Functions).
- **`scripts/dev-refresh.js`:** Local helper that repeatedly hits `/api/sync/refresh` (with `DEV_REFRESH_INTERVAL_MS`, optional `DEV_REFRESH_ONCE`, and `DEV_REFRESH_BASE_URL` overrides).
- **pg_cron snippet (README):** If `pg_cron` is available, define `public.invoke_refresh_endpoint()` and schedule it every six hours so hosted Supabase keeps caches warm without manual intervention.

## Access Control & Safety
- **Admin gating:** `src/lib/admin-auth.ts` blends `ADMIN_EMAILS`, `ADMIN_USER_IDS`, `ADMIN_ROLES`, and database grants to gate `/admin/*` and administrative APIs.
- **Service secrets:** Keep `SERVICE_ROUTE_SECRET` private. `/api/hype/refresh` and `/api/sync/refresh` will respond with 401 if the header mismatch occurs.
- **Remote safety rules:** Never run destructive commands (`supabase db reset`, `drop table`) against production unless you intend to rebuild the entire environment. Prefer forward-only SQL, re-run migrations locally before shipping, and double-check `auth.users`/`profiles` alignment after any schema change.

## Reference Files
- `supabase/migrations/*` – canonical diff history; check the newest file before adding more. Key files: `20260307233000_prediction_events_admin.sql`, `20260307200000_align_predictions_to_uuid_seasons.sql`, `20260307191000_create_perform_transfer_rpc.sql`, `20260307192000_create_place_prediction_bet_rpc.sql`, `20260307223000_admin_access_defaults.sql`.
- `supabase/seed/admin_content.sql` – hero/announcement defaults plus `admin_display_config`.
- `supabase/seed/anime-offline-mapping.json` – offline fallback for identity mapping helpers.
- `src/lib` helpers – align business logic with migrations (e.g., `src/lib/predictions.ts` matches the constraints on `prediction_events`).
