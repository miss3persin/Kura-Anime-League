# Kura Anime League Roadmap

## Vision & Philosophy
Kura Anime League (KAL) is a seasonal fantasy anime platform for weebs, otakus, and hype seekers. Users draft seasonal anime shows, assemble waifu/husbando rosters, and compete through scores, polls, and community voting to earn KuraPoints (KP) and badges while keeping the experience free, social, and lightly gamified.

**Core beliefs**
- Minimalist, elegant interfaces with Japanese-inspired flair.
- Long, cyclical seasons (Winter → Spring → Summer → Fall) with automated phase transitions.
- MVP-first delivery: scalable pillars, no paid services, simple backend logic.
- Optional monetization by offering cosmetic upgrades or private leagues later.

## Theme & Palette
- **Background:** Amoled Black (`#000000`)
- **Primary text/UI:** Pure White (`#FFFFFF`)
- **Accent:** Neon anime gradients (pink, blue, purple) that rotate on navigation or reload.
- **Vibe:** Minimalist + elegant + anime-futuristic, with the accent color shifting subtly to keep each visit feeling alive.

## Core Features
1. **User Authentication**
   - Email/password signup, optional OAuth (Discord, MAL, AniList), and secure sessions.
2. **Draft / Team Selection**
   - Pick up to five seasonal anime, optional character/waifu/husbando picks, and manage a 20,000 KP budget with prices driven by the Hype Index.
   - Tactical captain roles double or inflate scores (Captain = 2×, Vice-Captain = 1.5×).
3. **Team / Profile Screen**
   - Showcase selections, cumulative KP, badges, and cosmetic options (avatars, usernames, optional items).
4. **Leaderboard & Leagues**
   - Global leaderboard and private leagues with invite codes, H2H matchups, and weekly KP tallies.
5. **Voting / Hype Mechanics**
   - Community polls orchestrated by admins.
   - Hype Index (stock market view) with price changes based on trending rank and rating, plus Market Pulse visibility.
6. **Scoring & Predictions**
   - Automated scoring engine driven by airing status, trending, and ratings.
   - Prediction markets for wagering KP on outcomes.
   - Transfer windows with two free swaps per week and paid extras.
7. **Admin / Content Management (CMS)**
   - Season automation engine (Draft → Live → Ended).
   - Hero banner, announcements, and layout toggles for featured modules.
   - Observability dashboards for API rate limits and admin activity logs.

## Technical Reliability & Infrastructure
- **Multi-source fallback:** AniList → Kitsu → anime cache ensures scores persist even if AniList rate-limits.
- **Rate-limit logging:** Every external API request tracks AniList/Kitsu budgets for later scrutiny.
- **Automation chart:** Visualizes season progress (Week 1/12) inside the admin dashboard.

## Tech Stack (free + MVP friendly)
| Layer     | Tool / Tech                         | Notes                                  |
|-----------|-------------------------------------|----------------------------------------|
| Frontend   | Next.js + TailwindCSS + Framer Motion | Minimalist, responsive UI              |
| Backend    | Next.js App Router (Serverless)      | Lightweight CRUD + scoring APIs        |
| Database   | Supabase (Postgres)                  | Users, teams, seasons, votes, logs     |
| Auth       | Supabase Auth                        | Login/signup/session management        |
| APIs       | AniList (primary) + Kitsu (fallback) | Seasonal lists, ratings, character data |
| Hosting    | Vercel Free Tier                     | Frontend + serverless backend host     |

## Screens / Pages
1. Landing page (hero, trending, playbook, market pulse)
2. Squad page (lineup + transfers)
3. Leagues page (create/join leagues)
4. Hype Index (ticker, price history, trends)
5. Predictions page (KP wagers, bet history)
6. Admin dashboard (CMS, automation, logs, users, polls)
7. Rankings (global leaderboard)

## Notes & Constraints
- Spring 2026 focus: Week 1 runs April 1–7; Week 4 ends April 22–30, 2026.
- Scoring stays spoiler-free through status-driven logic.
- Keep the Amoled Black + neon accent aesthetic consistent.

## Implementation Roadmap
### Phase 1 — Database Schema (SQL, manual run)
- Tables: `leagues`, `league_members`, `matchups`, `weekly_scores`, `transfers`, `predictions`, `weekly_scores_log`, `api_rate_limit_logs`, `admin_content` (hero/announcement CMS).

### Phase 2 — Scoring Engine (API route)
- `/api/score-week`: weekly score calculator that layers:
  - +100 KP per episode aired (via `fetchAiringStatuses` with AniList → Kitsu → cache fallback).
  - +50 KP for trending (top 10).
  - +25 KP if average score ≥ 80.
  - ×2 for Captain, ×1.5 for Vice-Captain.
  - −50 KP for HIATUS/NOT_YET_RELEASED statuses.

### Phase 3 — Feature Pages
- `/leagues`: create/join/manage private leagues.
- `/squad`: lineup management with Captain/VC + transfer window.
- `/hype`: Hype Index board (normalization + decay in price).
- `/predict`: Prediction minigame with KP wagers.

### Phase 4 — Sidebar & AppShell Updates
- New navigation links: Leagues, Squad, Hype Index, Predict.
- Weekly score updates in the global header.
- New global site broadcast banner for announcements.

### Phase 5 — Admin Dashboard & Guarded APIs
- `/admin` workspace locked behind `/api/admin/*` routes.
- CMS controls for hero banner, site announcements (neutral/accent/warning tones), and module toggles.
- Monitoring: season automation chart, Spring 2026 phase tracker, API rate-limit monitor, activity logs, and poll management controls.
- User & permissions card with `/api/admin/users`, inline role dropdown, suspend toggle, and persist button.

## Key Files & Status
- `src/app/leagues/page.tsx` — Implemented (private leagues UX).
- `src/app/squad/page.tsx` — Implemented (lineup + transfers).
- `src/app/hype/page.tsx` — Implemented (market normalization + decay).
- `src/app/predict/page.tsx` — Implemented (wagering + balance tracking).
- `src/app/admin/page.tsx` — Updated (CMS controls, automation, logs, polls, user mgmt).
- `src/app/api/score-week/route.ts` — Implemented (multi-source scoring fallback).
- `src/app/api/hype/route.ts` — Implemented (price-history snapshots).
- `src/lib/animeSources.ts` — New (AniList → Kitsu → cache fallback logic).
- `src/lib/apiRateLimit.ts` — New (rate-limit observability).
- `src/components/ui/app-shell.tsx` — Updated navigation + global announcements.






