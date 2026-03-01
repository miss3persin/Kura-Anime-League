# Kura Anime League (KAL) Project Guide

## Vision & Philosophy
KAL is a seasonal fantasy anime platform for weebs, otakus, and hype seekers. Users draft seasonal anime shows, assemble waifu/husbando rosters, and compete through scores, polls, and community voting to earn KuraPoints (KP) and badges while keeping the experience free, social, and lightly gamified.

**Core beliefs**
- Minimalist, elegant interfaces with Japanese-inspired flair.
- High-resolution visual fidelity (AniList ExtraLarge covers).
- Forward-looking dashboards (Upcoming Season focus).
- Compliance and safety (Strict 16+ recruitment rules).
- MVP-first delivery with scalable pillars and no paid services.

## Theme & Palette
- **Background:** Amoled Black (`#000000`)
- **Primary text/UI:** Pure White (`#FFFFFF`)
- **Accent:** Neon anime gradients (pink, blue, purple).
- **Vibe:** Minimalist + elegant + anime-futuristic.

## Core Features
1. **User Authentication**
   - Supabase Auth integration for secure sessions.
2. **Draft / Team Selection**
   - **Anime Drafting:** Pick five seasonal series within a 20,000 KP budget.
   - **Character Recruitment:** Hire top-tier Waifus/Husbandos (16+ age requirement enforced).
   - **Tactical Roles:** Captain (2×) and Vice-Captain (1.5×) multipliers.
3. **Seasonal Dashboard**
   - Dynamic rotation that shifts focus to the **Upcoming Season** as soon as drafting begins.
   - High-fidelity carousel and trending lists using extraLarge AniList assets.
4. **Hype Index & Market Pulse**
   - **Hype Index:** Ticker-style market view with daily price swings and historical data.
   - **Market Pulse:** A global mixed feed of active and upcoming shows to track momentum.
   - **Laptop Optimization:** Compressed layouts and natural terminology for better UX.
5. **Scoring & Predictions**
   - Automated scoring engine driven by airing status, ratings, and community buzz.
   - Prediction markets for wagering KP on outcomes.
6. **Leads & Leagues**
   - Global leaderboard and private leagues with invite codes, H2H matchups, and weekly KP tallies.
7. **Admin / CMS**
   - Season automation engine (Draft → Live → Ended).
   - Hero banner, announcements, and layout toggles.
   - Observability dashboards for API rate limits and activity logs.

## Technical Architecture
| Component | Tool / Implementation | Status |
|-----------|-----------------------|--------|
| **Frontend** | Next.js + TailwindCSS + Framer Motion | Optimized for Laptops |
| **Database** | Supabase (Postgres) + UUID Seasons | Fully Implemented |
| **API Sync** | AniList (GraphQL) + Kitsu + TMDB | Multi-source enrichment |
| **Enrichment** | TMDB (Strict Anime Filter) | Prevent Live-Action Banners |
| **Admin** | Lazy-Loading Supabase Admin Client | Proxy-based safety |

## Implementation Progress (Updated March 2026)

### Phase 1 — Database & High-Res Core (DONE)
- Transitioned to **UUID seasons** for robust relational logic.
- Implemented **Identity Mapping** (AniList ↔ Kitsu ↔ MAL ↔ TMDB).
- Enforced **High-Res Strategy** (ExtraLarge posters) across all modules.

### Phase 2 — Character Recruitment Engine (DONE)
- **Strict 16+ Rule:** Automated age extraction from AniList API and descriptions.
- **Ambiguity Filter:** Characters without stated ages are excluded for safety.
- **Uniqueness Rule:** Limited to one Waifu and one Husbando per anime series.
- **Intel Modals:** Added comprehensive dossiers with auto-scrubbed bios.

### Phase 3 — Seasonal Dashboard & UX (DONE)
- **Automatic Rotation:** Homepage now pivots focus to the upcoming draft cycle.
- **Laptop UX:** Redesigned Hype Index modals with header-posters and fixed heights.
- **Terminology Polish:** Replaced "techy" lingo with "Show Details", "Price Ranges", etc.

### Phase 4 — Infrastructure & Reliability (DONE)
- **TMDB Strict Filter:** Prevents K-Drama/Live-Action data from polluting the UI.
- **Admin Client Proxy:** Allows dev scripts to load environment variables lazily.
- **Scoring Engine Fallbacks:** Robust cross-API status checks (AniList → Kitsu → Cache).

### Phase 5 — Competition & Leagues (IN PROGRESS)
- Private league invite codes.
- Weekly Head-to-Head matchups.
- Achievement system (Arc tracking).

## UX Standards
- **Title Priority:** Always show English Title. Fallback to Romaji only if English is null.
- **Visual Ratios:** 3/2 for banners, 3/4 for posters, 4/5 for laptop-optimized cards.
- **Poster Height:** In detail modals, posters should be compressed (e.g., 100px fixed height) to accommodate shorter screens.
- **Terminology:** Avoid "techy/sci-fi" lingo. Use natural fantasy league terms (e.g., "Dismiss" instead of "Deactivate").
- **Scrubbing:** All character bios must be stripped of HTML, `__markdown__`, and technical metadata headers (Height, Age, etc.).

## Key Files & Status
- `src/lib/supabase/admin.ts` — Lazy-loading admin client.
- `src/lib/sync.ts` — Character eligibility and age parsing logic.
- `src/app/hype/page.tsx` — Laptop-optimized market dashboard.
- `src/app/draft/page.tsx` — 16+ recruitment engine.
- `scripts/trigger-sync.ts` — Environment-aware enrichment script.
- `src/app/leagues/page.tsx` — Private leagues UX.
- `src/app/squad/page.tsx` — Lineup + transfers.
- `src/app/predict/page.tsx` — Prediction wagering + balance tracking.
- `src/app/admin/page.tsx` — CMS controls, automation, logs, polls.
