# KAL Feature Implementation Plan

## Phase 1 — Database Schema (SQL — User must run)
New tables needed:
- `leagues` — private leagues with join codes
- `league_members` — user memberships in leagues  
- `matchups` — H2H weekly matchups within leagues
- `weekly_scores` — weekly score record per team
- `transfers` — transfer log per team per week
- `predictions` — user predictions with KP wagers
- `weekly_scores_log` — running total scoring audit
- `api_rate_limit_logs` — **NEW:** Track AniList/Kitsu budget usage
- `admin_content` — **NEW:** Store CMS fields (hero, announcements, config)

## Phase 2 — Scoring Engine (API Route)
- `/api/score-week` — calculates weekly scores for all teams
  - +100 KP base per episode aired (via `fetchAiringStatuses` with fallback)
  - +50 KP if anime is in top 10 trending
  - +25 KP if average score ≥ 80
  - ×2 for Captain pick
  - ×1.5 for Vice-Captain pick
  - -50 KP if show went on break/hiatus (Status: HIATUS or NOT_YET_RELEASED)

## Phase 3 — Feature Pages
- `/leagues` — Private Leagues page (create, join, manage)
- `/squad` — Squad Management with Captain/VC + Transfer Window
- `/hype` — Hype Index page (stock market view of anime scores)
- `/predict` — Weekly Predictions minigame

## Phase 4 — Sidebar & AppShell Updates
- Add new nav links: Leagues, Squad, Hype Index, Predict
- Weekly score update in header
- **NEW:** Global Site Broadcast banner (site-wide announcements)

## Phase 5 — Admin Dashboard & Guarded APIs
- Centralized `/admin` workspace protected by `/api/admin/*` routes.
- **CMS Controls:** 
  - Edit Hero Banner (Headline, Subtitle, CTA)
  - Toggle Site-wide Announcement (Message, Tone: Neutral/Accent/Warning)
  - Display Config Toggles (Trending, Market Pulse, Playbook, Leaderboard, Timeline)
- **Monitoring & Automation:**
  - Season Automation Chart (Visual progress % per season)
  - Real-time Spring 2026 Phase Tracker (Week 1-4 callouts)
  - API Rate Limit Monitor (Observability for AniList/Kitsu budgets)
  - Activity Logs & Poll Management (Create/Pause/Reset community polls)
- Users & Permissions card: fetch + refresh via `/api/admin/users`, inline role dropdown, suspend toggle, and save button.

## Files to Create/Modify
- `src/app/leagues/page.tsx` — IMPLEMENTED
- `src/app/squad/page.tsx` — IMPLEMENTED (Lineup + Transfers)
- `src/app/hype/page.tsx` — IMPLEMENTED (Normalization + Decay)
- `src/app/predict/page.tsx` — IMPLEMENTED (Wagers + Balance)
- `src/app/admin/page.tsx` — UPDATED (CMS, Automation Chart, Logs, Polls, Users)
- `src/app/api/score-week/route.ts` — IMPLEMENTED (Multi-source fallback logic)
- `src/app/api/hype/route.ts` — IMPLEMENTED (Price history snapshots)
- `src/lib/animeSources.ts` — **NEW:** AniList → Kitsu → Cache fallback logic
- `src/lib/apiRateLimit.ts` — **NEW:** Observability for rate limit budgets
- [src/components/ui/app-shell.tsx](file:///c:/Users/victo/Documents/CODES/KAL/src/components/ui/app-shell.tsx) — Update nav + Announcements
