# Kura Anime League Roadmap

## Vision & Philosophy
Kura Anime League (KAL) is a seasonal fantasy anime platform for weebs, otakus, and hype seekers. Users draft seasonal anime shows, assemble waifu/husbando rosters, and compete through scores, polls, and community voting to earn KuraPoints (KP) and badges while keeping the experience free, social, and lightly gamified.

**Core beliefs**
- Minimalist, elegant interfaces with Japanese-inspired flair.
- High-resolution visual fidelity (AniList ExtraLarge covers).
- Forward-looking dashboards (Upcoming Season focus).
- Compliance and safety (16+ recruitment rules).

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
- **Title Priority:** English Title > Romaji.
- **Visual Ratios:** 3/2 for banners, 3/4 for posters, 4/5 for laptop-optimized cards.
- **Scrubbing:** All character bios must be stripped of HTML, `__markdown__`, and technical metadata headers.
