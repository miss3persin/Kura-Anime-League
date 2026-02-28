import { NextResponse } from 'next/server';
import { fetchAiringStatuses } from '@/lib/animeSources';
import { createClient } from '@supabase/supabase-js';
import { requireServiceSecret } from '@/lib/service-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EPISODE_POINTS = 100;
const TRENDING_BONUS = 50;
const RATING_BONUS = 25;
const CAPTAIN_MULTIPLIER = 2.0;
const VICE_CAPTAIN_MULTIPLIER = 1.5;
const HIATUS_PENALTY = -50;

interface TeamPick {
    anime_id: number;
}

interface Team {
    id: string;
    user_id: string;
    captain_anime_id: number | null;
    vice_captain_anime_id: number | null;
    season_kp: number | null;
    team_picks: TeamPick[];
}

interface AnimeStatus {
    id: number;
    status: string;
    trending: number;
    averageScore: number | null;
    popularity: number;
    nextAiringEpisode?: {
        airingAt: number;
        episode: number;
    } | null;
}

export async function POST(request: Request) {
    const unauthorized = requireServiceSecret(request);
    if (unauthorized) {
        return unauthorized;
    }

    try {
        const { week_number, season_id } = await request.json();

        if (!week_number || !season_id) {
            return NextResponse.json({ error: 'Missing week_number or season_id' }, { status: 400 });
        }

        // 1. Get all teams for the season with their picks
        const { data: rawTeams, error: teamsError } = await supabaseAdmin
            .from('teams')
            .select(`
        id, user_id, captain_anime_id, vice_captain_anime_id, season_kp,
        team_picks(anime_id)
      `)
            .eq('season_id', season_id);

        if (teamsError || !rawTeams?.length) {
            return NextResponse.json({ error: 'No teams found', details: teamsError }, { status: 404 });
        }

        const teams = rawTeams as unknown as Team[];

        // 2. Get all unique anime IDs across all teams
        const allAnimeIds = [...new Set(
            teams.flatMap(t => t.team_picks.map(p => p.anime_id))
        )];

        if (!allAnimeIds.length) {
            return NextResponse.json({ error: 'No anime picks found' }, { status: 404 });
        }

        // 3. Fetch live status (tries AniList, falls back to Kitsu/cache on rate-limit)
        const animeStatuses = await fetchAiringStatuses(allAnimeIds) as Record<number, AnimeStatus>;

        // 4. Calculate scores per team
        const weekScores = [];
        const teamScoreMap: Record<string, number> = {};

        for (const team of teams) {
            const picks = team.team_picks.map(p => p.anime_id);
            let totalScore = 0;
            const breakdown: Record<number, number> = {};

            for (const animeId of picks) {
                const status = animeStatuses[animeId];
                if (!status) continue;

                let score = 0;

                // Base: episode aired this week?
                const airedRecently = status.nextAiringEpisode &&
                    (Date.now() / 1000 - status.nextAiringEpisode.airingAt) < 7 * 24 * 3600;
                if (airedRecently || status.status === 'RELEASING') {
                    score += EPISODE_POINTS;
                }

                // Bonus: trending
                if (status.trending > 50) {
                    score += TRENDING_BONUS;
                }

                // Bonus: high rating (≥ 80)
                if ((status.averageScore ?? 0) >= 80) {
                    score += RATING_BONUS;
                }

                // Penalty: hiatus
                if (status.status === 'HIATUS' || status.status === 'NOT_YET_RELEASED') {
                    score += HIATUS_PENALTY;
                }

                // Multipliers
                if (team.captain_anime_id === animeId) {
                    score = Math.round(score * CAPTAIN_MULTIPLIER);
                } else if (team.vice_captain_anime_id === animeId) {
                    score = Math.round(score * VICE_CAPTAIN_MULTIPLIER);
                }

                breakdown[animeId] = score;
                totalScore += score;
            }

            const finalScore = Math.max(0, totalScore);

            weekScores.push({
                team_id: team.id,
                season_id,
                week_number,
                score: finalScore,
                breakdown,
                season_kp_running_total: (team.season_kp ?? 0) + finalScore,
                calculated_at: new Date().toISOString()
            });

            teamScoreMap[team.id] = finalScore;
        }

        // 5. Upsert weekly scores
        const { error: scoreError } = await supabaseAdmin
            .from('weekly_scores')
            .upsert(weekScores, { onConflict: 'team_id,week_number' });

        if (scoreError) throw scoreError;

        // 6. Update profiles total_kp + team season_kp + season_scores table
        for (const team of teams) {
            const earned = teamScoreMap[team.id] || 0;
            // All-time KP
            await supabaseAdmin.rpc('increment_kp', { user_id: team.user_id, amount: earned });
            // Season KP on team row
            await supabaseAdmin
                .from('teams')
                .update({ season_kp: (team.season_kp ?? 0) + earned })
                .eq('id', team.id);
            // Season leaderboard
            await supabaseAdmin.rpc('upsert_season_kp', {
                p_user_id: team.user_id,
                p_season_id: season_id,
                p_amount: earned
            });
        }

        // 7. Update Hype Index + snapshot hype_history
        for (const [animeIdStr, status] of Object.entries(animeStatuses)) {
            const animeId = parseInt(animeIdStr);
            const id = animeId;
            const hype = Math.min(100, Math.round((status.trending / 500) * 100));
            const newCost = Math.max(500, Math.round(
                1000 + (status.popularity / 1000) + (status.trending * 5)
            ));

            const { data: rawOldAnime } = await supabaseAdmin
                .from('anime_cache')
                .select('hype_score, cost_kp')
                .eq('id', id)
                .single();

            const oldAnime = rawOldAnime as { hype_score: number; cost_kp: number } | null;
            const oldHype = oldAnime?.hype_score ?? hype;
            const changePct = oldHype > 0 ? Math.round(((hype - oldHype) / oldHype) * 100) : 0;

            await supabaseAdmin
                .from('anime_cache')
                .update({ hype_score: hype, cost_kp: newCost, hype_change: changePct, status: status.status })
                .eq('id', id);

            await supabaseAdmin.from('hype_history').upsert({
                anime_id: id,
                season_id,
                week_number,
                hype_score: hype,
                cost_kp: newCost,
                trending: status.trending,
                change_pct: changePct,
                scored_at: new Date().toISOString()
            }, { onConflict: 'anime_id,week_number,season_id' });

            await supabaseAdmin.from('anime_history').insert({
                anime_id: id,
                points: status.averageScore || 0,
                change_percent: changePct
            });
        }

        return NextResponse.json({
            success: true,
            week: week_number,
            teams_scored: weekScores.length,
            scores: teamScoreMap
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Score Week Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ message: 'POST to /api/score-week with { week_number, season_id }' });
}
