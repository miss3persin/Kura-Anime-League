# Kura Anime League (KAL) Project Guide

## Vision & Product Direction
KAL is built to be the full-season fantasy anime control center: a richly visual experience where draft wizards, market
analysts, and prediction bettors plan, compete, and monitor their squads without ever touching a raw database. The platform
prioritizes a single app surface that exposes KP budgets, hype pricing, season timelines, league leadership, and admin-grade
controls with just enough automation to keep every season rolling (draft locks, transfer reviews, notifications, and sync jobs
run themselves once the service secrets are provisioned).

## Tech Stack & Tooling
- **Frontend:** Next.js 16.1.6 with React 19, Tailwind CSS 4, Framer Motion, lucide-react icons, and Tailwind Merge for class
  composition. Typed via TypeScript 5.
- **Data & Auth:** Supabase Postgres + Supabase Auth through `@supabase/supabase-js` clients (`src/lib/supabase/client.ts` and
  `src/lib/supabase/admin.ts`).
- **Utilities:** `clsx`, `tailwind-merge`, `next-themes`, and the `tsx`/`node:test` harnesses that prove `calcCostKp` and character
  pricing stay inside the market bands.
- **Scripts:** `npm run dev`, `npm run build`, `npm run lint`, `npm run test:unit`, and `npm run dev-refresh` (runs
  `scripts/dev-refresh.js`).

## Directory Overview
- `src/app`: Route definitions for home, hype, squad, draft, leagues, admin, support, notifications, and the API surface.
- `src/components`: Shared UI blocks such as `AppShell`, `PageHelpCenter`, modals, neon buttons, and profile widgets.
- `src/lib`: Helpers for Supabase, hype math, character pricing, identity mapping, season timelines, TMDB lookups, and prediction option normalization.
- `supabase`: Migration history, seed SQL, the Edge function mirror under `functions/`, and `seed/anime-offline-mapping.json`.
- `scripts`: `dev-refresh.js` to repeatedly hit `/api/sync/refresh`.
- `tests`: Unit checks for the pricing/math helpers under `tests/hype-cost.test.ts` and `tests/character-market.test.ts`.

## Global UI Infrastructure
- **App shell (`src/components/ui/app-shell.tsx`):** Handles the navigation rail, KP badge, theme toggle, notifications drawer, admin-exclusive nav item, and the `PageHelpCenter` launcher. It regularly refreshes `/api/seasons/current`, keeps `notification_preferences` in sync, and gracefully shows sample notifications when the user is not signed in.
- **Theme Provider (`src/components/theme-provider.tsx`):** Wraps `<html>` to honor `next-themes` defaults while exposing a persistent dark/light toggle.
- **Season Phase Banner (`src/components/ui/season-banner.tsx`):** Uses `useSeasonTimeline` (`src/lib/hooks/useSeasonTimeline.ts`) to derive a timeline row, countdown, CTA label, and CTA link that appear across home, draft, and admin surfaces.
- **Page Help Center (`src/components/ui/page-help-center.tsx` + `src/lib/page-help.ts`):** Injects contextual guidance into every major view and renders the same text the admin editing workflow writes.
- **Neon CTA & Modal primitives:** `src/components/ui/neon-button.tsx` and `modal.tsx` keep confirmation/UI state consistent for draft saves, transfers, and admin writes.

## Player Experiences

### Home & Market Pulse
- **Landing page (`src/app/page.tsx`):** Loads `/api/seasons/current`, `supabase.from("anime_cache")`, `/api/market`, and `/api/content` to render the hero carousel, carousel/trending rows, market pulse, leaderboard preview, announcement, and timeline toggles. Hero content and visibility switches are backed by `admin_display_config` so the marketing copy stays data-driven.
- **Market math:** KP deltas (1H/24H/7D) are calculated with `getHistoryChange` (`src/lib/hype.ts`), mirroring the `/api/market` payload so hot paging is always honest.

### Draft & Squad Management
- **Draft board (`src/app/draft/page.tsx`):** Uses `useSeasonTimeline`, `useCountdown`, and Supabase queries against `anime_cache`/`character_cache` to enforce KP budgets, draft phase gating, and eligibility filters. Character lists impose age/gender and favorites thresholds derived from `src/lib/character-market.ts`.
- **Squad overview:** `/api/squad?userId=` (`src/app/api/squad/route.ts`) joins `teams`, `team_picks`, `character_picks`, and `weekly_scores` so the UI can display KP budgets, transfers used, captain/vice-captain roles, and the latest weekly score.
- **Transfers & tactical roles:** `POST /api/squad/transfer` hits the `perform_transfer` RPC (see `supabase/migrations/20260307191000_create_perform_transfer_rpc.sql`) to atomically replace picks, update KP, and log the transfer. `POST /api/squad/assign-role` toggles captain/vice-captain assignments with guardrails to prevent conflicting roles.
- **Saving & feedback:** The draft page opens confirmation modals, shows hero loading states, and tracks `selectedAnimeIds`, `starCharId`, and `budget` so players know exactly when a save or transfer will succeed.

### Hype Index & Predictions
- **Hype page (`src/app/hype/page.tsx`):** Displays sortable/paginated market data, search, filter chips, and a detail modal. It refreshes data through `/api/market` (which reads `anime_cache` and `hype_history`) and can trigger `/api/hype/refresh` (guarded by `requireServiceSecret`).
- **Price recalculations:** `src/lib/server/hype-sync.ts` fetches AniList trending data, supplements it with MAL stats (`src/lib/jikan.ts`), computes KP via `calcCostKp`, pushes history via `appendHypeHistory`, and writes updates to `anime_cache`. The same flow powers `/api/hype/refresh`.
- **Prediction experience:** `/app/predict` calls `/api/predictions` for upcoming/past events (driven by `prediction_events` & `predictions`) and posts to `/api/predictions/place-bet` (which validates deadlines, options via `normalizePredictionOptions`, deducts KP, and writes a prediction row).

### Profile, Leagues, Rankings & Polls
- **Profile deck (`src/app/profile/page.tsx`):** Calls `/api/profile/[id]` to render `ProfileHeader`, `StatsGrid`, `AchievementsList`, and `LeaguesList`. The API aggregates KP, accuracy, achievements, and league memberships from `profiles`, `teams`, `user_achievements`, and `league_members`.
- **Leagues/rankings/polls:** Routes under `src/app/leagues`, `src/app/rankings`, and `src/app/polls` consume the matching API endpoints and use shared `AppShell`/`PageHelpCenter` wrappers so the whole experience feels cohesive.

### Notifications, Support & Settings
- **Notifications:** `AppShell` fetches `/api/notifications`, deduplicates channels, and surfaces the `notification_preferences` data that backs the tray toggles. `PATCH /api/notifications` lets players mark all read or flip push/email preferences.
- **Support & settings:** Static `support` content leverages the help center copy, while `/settings` exposes preference toggles that call the same notifications endpoint.

## Admin & Content Operations
- **Admin dashboard (`src/app/admin/page.tsx`):** Aggregates user data (`/api/admin/users`), grants (`admin_access` helpers), hero/announcement content (`/api/admin/content`), seasons, polls, prediction events, and admin action logs. It uses `requireAdmin` (`src/lib/admin-auth.ts`), `admin-access.ts`, and `admin-data.ts` for safe CRUD.
- **Access & content defaults:** Admin grants are persisted in `admin_access_config` (seeded via `supabase/seed/admin_content.sql` plus the migration that adds Victor’s admin grant with 700K KP). Hero and announcement widgets drive `project` hero copies stored in `admin_content`.
- **Season & prediction controls:** `/api/admin/seasons` lets admins move draft deadlines and statuses while `/api/admin/predictions` lets them craft prediction events with option metadata persisted in `prediction_events`.

## API & Background Jobs
- **Service guarding:** `requireServiceSecret` (`src/lib/service-auth.ts`) protects `/api/sync/refresh` and `/api/hype/refresh`. The secret lives in `SERVICE_ROUTE_SECRET` and is never shipped to the browser.
- **Refresh cycle:** `POST /api/sync/refresh` launches `runRefreshCycle` (`src/lib/refreshCycle.ts`), loops through `determineSeasonContexts`, fetches seasonal AniList data, writes `anime_cache`/`character_cache`, runs identity mapping, records `livechart_breaks`, and logs the job in `refresh_cycles`.
- **Dev helpers:** `scripts/dev-refresh.js` (driven by environment overrides like `DEV_REFRESH_INTERVAL_MS`) and `supabase/functions/sync-refresh` forwarder both hit `/api/sync/refresh`. The README includes a `pg_cron` snippet if you prefer scheduling inside the database.
- **Hype regeneration:** `/api/hype/refresh` calls `syncHypeMarket` to compute hype scores, cost deltas, and update `anime_cache` along the same axes used by `/api/market`.

## Libraries & Data Helpers
- **Hype & characters:** `src/lib/hype.ts` and `src/lib/character-market.ts` define `calcCostKp`, `appendHypeHistory`, `calcCharacterPrice`, and history helpers consumed by both hype and character syncs.
- **Season helpers:** `useSeasonTimeline`/`season-banner` centralize deadline visibility, CTA labeling, and countdown math used by home, draft, and admin.
- **Identity & sourcing:** `src/lib/identityMapping.ts` merges AniList IDs with Kitsu/Jikan (with a fallback offline map in `supabase/seed/anime-offline-mapping.json`), while `src/lib/animeSources.ts`, `src/lib/tmdb.ts`, and `src/lib/livechart.ts` back the market sync flow.
- **Predictions:** `src/lib/predictions.ts` normalizes option payloads and keeps the UI aligned with `prediction_events` + `predictions`.
- **Page help center:** `src/lib/page-help.ts` provides the same copy rendered by the admin help editor and the `PageHelpCenter` menu.
- **Tests:** `tests/hype-cost.test.ts` and `tests/character-market.test.ts` ensure the mathematical models stay within the ranges defined by the migrations.

## Development & Operations
- **Env matrix:** The README lists `SERVICE_ROUTE_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `ADMIN_USER_IDS`, `ADMIN_ROLES`, `TMDB_API_KEY`, and the `DEV_REFRESH_*` overrides. Keep service credentials server-only (see `src/lib/service-auth.ts` and `src/lib/supabase/admin.ts`).
- **NPM scripts:** `npm run dev`/`build`/`start`, `npm run lint`, `npm run test:unit`, and `npm run dev-refresh`.
- **Deployment:** `.github/workflows/lint.yml` runs lint + unit tests on pushes/PRs, and Vercel is the recommended host because it handles secrets and the required Next.js feature set.

## Monitoring & Observability
- **Refresh cycles & rate logs:** `refresh_cycles` records each `runRefreshCycle` and `api_rate_limit_logs` captures AniList/Kitsu headers (see `src/lib/apiRateLimit.ts`), so you can audit sync frequency and API usage.
- **Notifications surface:** `/api/notifications` operates on `notifications` + `notification_preferences` to keep the tray in sync; admins can seed push/email copy via Supabase.
- **Help center:** `PageHelpCenter` exposes static guidance (from `src/lib/page-help.ts`) on every major route so documentation is never far from the workflow.
