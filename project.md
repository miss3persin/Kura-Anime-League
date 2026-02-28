# 🏮 Kura Anime League (KAL) — Project Specification

---

## 1️⃣ Project Overview

**Kura Anime League (KAL)** is a **seasonal fantasy anime platform** designed for weebs, otakus, and anime enthusiasts. Users **draft anime shows, characters, waifu/husbando picks, etc** each season, compete in **popularity contests, community voting, and hype-based challenges**, and earn **KuraPoints (KP)** and badges.  

**Core Philosophy:**  
- Minimalist, elegant, and anime-Japanese inspired interface  
- Long-term seasonal cycles: Winter, Spring, Summer, Fall  
- Focused on **fun, social engagement, and community-driven hype**  
- Fully **vibe-coder friendly**: free tools, no paid services, simple backend logic  
- **MVP first**: core playable features, scalable, maintainable  
- Optional **future monetization**: donate button, cosmetic upgrades, private leagues  

---

## 2️⃣ Color Palette & Theme

- **Primary Background:** Amoled Black `#000000`  
- **Primary Text / UI Elements:** Pure White `#FFFFFF`  
- **Accent Color:** Neon/Anime-inspired (Pink, Blue, Purple, or similar)  
  - Accent color dynamically **changes per page reload or page navigation**  
  - Provides subtle energy while maintaining minimalist elegance  
- **Vibe:** Minimalist + elegant + Japanese-inspired + anime-futuristic  

---

## 3️⃣ Core Features

1. **User Authentication**  
   - Signup / Login via email/password  
   - Optional OAuth: Discord, MAL, AniList  
   - Secure session management, free-tier friendly  

2. **Draft / Team Selection**  
   - Users pick:  
     - Seasonal anime shows (Max 5 picks)  
     - Optional characters (main + waifu/husbando)  
   - Budget system: 20,000 KP starting budget; prices fluctuate based on Hype Index  
   - Draft locks at season start  
   - **Tactical Roles:** Set one Captain (2x points) and one Vice-Captain (1.5x points)  

3. **Team / Profile Screen**  
   - Display picks, cumulative KuraPoints (KP), badges  
   - Profile customization: avatar, username, optional cosmetic items  

4. **Leaderboard & Leagues**  
   - Global leaderboard for all users  
   - **Private Leagues:** Create/Join with invite codes, Head-to-Head (H2H) matchups  
   - Weekly KuraPoints (KP) + cumulative season KP  

5. **Voting / Hype Mechanics**  
   - **Community Polls:** Admins manage weekly questions; users vote to drive engagement  
   - **Hype Index:** Rolling stock market view of anime. Prices change based on trending rank and score  
   - **Market Pulse:** Real-time visibility into price swings and trending shows  

6. **Scoring & Predictions**  
   - **Scoring Engine:** Automated weekly points based on airing status, trending, and ratings  
   - **Prediction Markets:** Wager KP on upcoming events (e.g., "Will Hero Academia hit 8.5 score?")  
   - **Transfer Window:** Swap picks weekly (2 free transfers, extra cost KP)  

7. **Admin / Content Management (CMS)**
   - **Season Control:** Automation engine to advance phases (Draft → Live → Ended)  
   - **CMS Controls:** Update Hero Banner content and Site-wide Announcements (Neutral/Accent/Warning tones)  
   - **Layout Toggles:** Live-toggle homepage modules (Trending, Market, Leaderboard, etc.)  
   - **Observability:** Monitor API rate limits (AniList/Kitsu) and audit Admin Activity Logs  

---

## 4️⃣ Technical Resilience & Logic

*   **Multi-Source Fallback:** If AniList rate-limits the platform, the system automatically falls back to **Kitsu API** or the local **Anime Cache** to ensure scores are always calculated.
*   **Rate Limit Logging:** Every external API request is tracked to monitor budget health.
*   **Automation Chart:** Visual tracking of season progress (Week 1/12) in the admin dash.

---

## 5️⃣ Technical Stack (Free / MVP Friendly)

| Layer                 | Tool / Tech                           | Notes                                         |
| --------------------- | ------------------------------------- | --------------------------------------------- |
| Frontend              | Next.js + TailwindCSS + Framer Motion | Minimalist UI, responsive, free               |
| Backend               | Next.js App Router (Serverless)       | Lightweight API endpoints for CRUD & scoring  |
| Database              | Supabase (Postgres)                   | Users, teams, seasons, votes, badges, logs    |
| Auth                  | Supabase Auth                         | Handles login/signup/sessions                 |
| APIs                  | AniList (Primary), Kitsu (Fallback)   | Seasonal lists, ratings, characters, mapping  |
| Hosting               | Vercel Free Tier                      | Frontend + backend serverless                 |

---

## 6️⃣ Screens / Pages (Implemented)

1. **Landing Page:** Hero banner, trending, playbook, market pulse  
2. **Squad Page:** Lineup management, Captaincy, Transfer Window  
3. **Leagues Page:** Private league creation, Browse public leagues, Join codes  
4. **Hype Index:** Stock ticker view, Price history, Price trends  
5. **Predictions Page:** KP wagering, active bets, settlement history  
6. **Admin Dashboard:** CMS, Automation, Logs, User management, Polls  
7. **Rankings:** Global leaderboard  

---

## 7️⃣ Notes / Constraints

*   Spring 2026 is the active/upcoming focus (Week 1: April 1-7; Week 4: April 22-30, 2026).
*   Scoring logic is spoiler-free (status-based).
*   Minimalist Japanese vibe maintained via Amoled Black and Neon Accents.
