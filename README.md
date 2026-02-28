This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment Variables

- `SERVICE_ROUTE_SECRET` (required for production): the shared header value that guards the scoring, hype, season, and sync APIs. Supply a strong, unique string and keep it out of client bundles.
- `ADMIN_EMAILS` (optional): comma-delimited list of Supabase emails that should be able to reach `/admin`. This value is only used server-side.
- `ADMIN_USER_IDS` (optional): if you prefer user IDs instead of emails, list them here (comma separated). They are matched against Supabase auth IDs.
- `ADMIN_ROLES` (optional, defaults to `admin`): additional values to match against `user_metadata.role`/`app_metadata.role` for admin access.

## Timeline & Budget Automation

- New launches and accounts automatically default to **20,000 KP** both in the Supabase profile trigger and across the UI, so every user starts with the same budget.
- The `SeasonPhaseBanner` (and related views such as the Draft page) now read a single `/api/seasons/current` timeline via `useSeasonTimeline`. It renders the upcoming deadlines, automatically derives phase labels, and shares the same data stack so every gating decision (draft locks, squad saves, dispatch buttons) stays in sync.
- An “Emergency Adjustments” control lets you override any deadline temporarily (draft open/close, season end, transfer review), while still falling back to the automated timeline when no overrides are active.

## Hype Index Enhancements

- The “24H Change” column is now a switchable control (1H, 24H, 7D) that reads the stored `hype_history` snapshots, so the displayed delta truly reflects the chosen timeframe.
- Each row now shows both the percent change and the raw KP delta for that range, keeping the pricing panel honest.

## Testing & CI

- Run `npm run lint` to validate the codebase.
- Run `npm run test:unit` to run the small Node.js `node:test` harness that exercises `calcCostKp`.
- A GitHub Actions workflow (`.github/workflows/lint.yml`) now runs both commands on pushes and pull requests against `main`/`master`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Multi-source Refresh & Rate-aware Sync

- `anime_cache` is the canonical store; all user-facing reads hit Supabase only. The refresh cycle, triggered manually or via your preferred scheduler, fans out to AniList/Kitsu/Jikan and logs each rate-limit header to `api_rate_limit_logs`.
- The refresh endpoint (`POST /api/sync/refresh`) creates a `refresh_cycles` record, fetches the seasonal AniList lineup, upserts anime & characters, auto-populates AniList→Kitsu→MAL matches, resolves airing status (AniList first, Kitsu fallback), and writes the results into `livechart_breaks` so scoring logic can detect breaks without hitting AniList again.
- Mapping maintenance now happens automatically: whenever a title lacks a mapping, the job searches Kitsu and Jikan by title and persists the result to `anime_identity_map`. No manual JSON drops are required anymore.
- `fetchAiringStatuses` still consults `livechart_breaks` and prefers that data when a show is marked as on break; the refresh job keeps that table updated on every run.

You can trigger the endpoint manually with the existing `SERVICE_ROUTE_SECRET` header (or hook it up to a Supabase Edge Function / GitHub Actions job once you have a scheduler). That way the app can stay responsive while the heavy sync work happens in the background.

### Local dev helper

- Run `SERVICE_ROUTE_SECRET=... npm run dev-refresh` to start `scripts/dev-refresh.js`. It POSTs to `/api/sync/refresh`, logs the response, and repeats the call every `DEV_REFRESH_INTERVAL_MS` (default 15 minutes). Set `DEV_REFRESH_ONCE=true` to run a single invocation or `DEV_REFRESH_BASE_URL` to target a non-local host during development.

### Supabase Edge function

- `supabase/functions/sync-refresh/index.ts` is a minimal Deno function that forwards requests to `/api/sync/refresh` using `SERVICE_ROUTE_SECRET`/`REFRESH_BASE_URL`. Deploy it with the Supabase CLI and set those env vars so the function can run safely in production or from `pg_cron`.

### pg_cron definition

- Install `pg_cron` into `pg_catalog` (Supabase enforces this schema location):

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
  ```

- Add the `http` extension (for safe webhook calls) and a helper that posts to the refresh endpoint. Replace `YOUR_DEPLOY_URL` and `YOUR_SECRET` before running:

  ```sql
  CREATE EXTENSION IF NOT EXISTS http;

  CREATE OR REPLACE FUNCTION public.invoke_refresh_endpoint()
  RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    PERFORM http_post(
      'https://YOUR_DEPLOY_URL/api/sync/refresh',
      json_build_object('headers', json_build_object('x-service-secret', 'YOUR_SECRET')),
      'application/json'
    );
  END;
  $$;
  ```

- Schedule the cron job every six hours (adjust the cron expression as needed):

  ```sql
  SELECT cron.schedule(
    'anime_cache_refresh',
    '0 */6 * * *',
    $$CALL public.invoke_refresh_endpoint();$$
  );
  ```

If `pg_cron` still refuses to install locally, keep using the Edge function or the dev helper until you can enable the extension in the hosted Supabase project.
