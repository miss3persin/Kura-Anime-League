import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { type AnimeHypeHistoryEntry } from "@/lib/hype";

export const dynamic = 'force-dynamic';

function parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Interface for anime pick details
export interface SquadAnimePick {
    id: number;
    title_romaji: string;
    title_english: string | null;
    cover_image: string;
    cost_kp: number;
    hype_score: number;
    hype_change: number;
    genres: string[];
    is_captain: boolean;
    is_vice_captain: boolean;
    hype_history?: AnimeHypeHistoryEntry[];
}

// Interface for character pick details
export interface SquadCharacterPick {
    id: number;
    name: string;
    image: string;
    role: string;
    price?: number;
    favorites?: number;
    pick_type: string; // e.g., 'STAR_CHAR', 'WAIFU_HUSBANDO'
}

type AnimePickRow = {
    anime_cache: {
        id: number;
        title_romaji: string;
        title_english: string | null;
        cover_image: string;
        cost_kp: number;
        hype_score: number;
        hype_change: number;
        genres: string[];
        hype_history?: AnimeHypeHistoryEntry[];
    } | {
        id: number;
        title_romaji: string;
        title_english: string | null;
        cover_image: string;
        cost_kp: number;
        hype_score: number;
        hype_change: number;
        genres: string[];
        hype_history?: AnimeHypeHistoryEntry[];
    }[];
};

type CharacterPickRow = {
    pick_type: string;
    character_cache: {
        id: number;
        name: string;
        image: string;
        role: string;
        favorites?: number;
        price?: number;
    } | {
        id: number;
        name: string;
        image: string;
        role: string;
        favorites?: number;
        price?: number;
    }[];
};

type SeasonRow = {
    id: string;
    week_number: number | null;
    draft_opens_at: string | null;
    draft_closes_at: string | null;
    end_date: string | null;
    status: string | null;
};

type TeamRow = {
    id: string;
    user_id: string;
    season_id: string;
    remaining_kp: number;
    transfers_used: number;
    free_transfers: number;
    captain_anime_id: number | null;
    vice_captain_anime_id: number | null;
    season_budget_kp?: number | null;
    locked_at?: string | null;
    locked_anime_at?: string | null;
    locked_characters_at?: string | null;
};

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

// Interface for the overall squad data
export interface SquadData {
    team_id: string;
    user_id: string;
    season_id: string;
    locked_at?: string | null;
    locked_anime_at?: string | null;
    locked_characters_at?: string | null;
    remaining_kp: number;
    remaining_kp_calculated?: number;
    transfers_used: number;
    free_transfers: number;
    captain_anime_id: number | null;
    vice_captain_anime_id: number | null;
    anime_picks: SquadAnimePick[];
    character_picks: SquadCharacterPick[];
    team_value_base?: number;
    team_value_boost?: number;
    team_value_total?: number;
    weekly_score: number | null; // For the most recent week
    current_week_number: number;
    // Add other relevant squad summary data here
}

type SquadEmptyResponse = {
    squadData: null;
    code: 'NO_ACTIVE_SEASON' | 'NO_TEAM';
    message: string;
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requestedSeasonId = searchParams.get('seasonId');

    if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        const supabase = getSupabaseAdmin();
        const now = new Date();

        // 1. Get seasons (active + upcoming)
        const { data: activeSeason } = await supabase
            .from('seasons')
            .select('id, week_number, draft_opens_at, draft_closes_at, end_date, status')
            .eq('status', 'active')
            .maybeSingle<SeasonRow>();

        const { data: upcomingSeason } = await supabase
            .from('seasons')
            .select('id, week_number, draft_opens_at, draft_closes_at, end_date, status')
            .eq('status', 'upcoming')
            .order('draft_opens_at', { ascending: true })
            .limit(1)
            .maybeSingle<SeasonRow>();

        const draftOpens = parseDate(upcomingSeason?.draft_opens_at);
        const draftCloses = parseDate(upcomingSeason?.draft_closes_at);
        const isUpcomingDraftWindow = Boolean(draftOpens && draftCloses && draftOpens <= now && now < draftCloses);

        let explicitSeason: SeasonRow | null = null;
        if (requestedSeasonId) {
            const { data: explicit } = await supabase
                .from('seasons')
                .select('id, week_number, draft_opens_at, draft_closes_at, end_date, status')
                .eq('id', requestedSeasonId)
                .maybeSingle<SeasonRow>();
            explicitSeason = explicit ?? null;
        }

        const targetSeason = explicitSeason
            ?? (isUpcomingDraftWindow ? upcomingSeason : null)
            ?? activeSeason
            ?? upcomingSeason;

        if (!targetSeason) {
            return NextResponse.json(
                {
                    squadData: null,
                    code: 'NO_ACTIVE_SEASON',
                    message: "There is no active season right now."
                } satisfies SquadEmptyResponse,
                { status: 200 }
            );
        }

        // 2. Fetch team data for the user and selected season
        const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('user_id', userId)
            .eq('season_id', targetSeason.id)
            .maybeSingle<TeamRow>();

        if (teamError || !teamData) {
            return NextResponse.json(
                {
                    squadData: null,
                    code: 'NO_TEAM',
                    message: "You have not created a team for the current season yet."
                } satisfies SquadEmptyResponse,
                { status: 200 }
            );
        }

        // Fetch team picks, character picks, and latest weekly score in parallel
        const [
            animePicksRes,
            characterPicksRes,
            weeklyScoreRes
        ] = await Promise.all([
            // 3. Fetch details for all anime picks (with hype data)
            supabase.from('team_picks')
                .select(`
                    anime_id,
                    anime_cache (
                        id, title_romaji, title_english, cover_image, cost_kp, genres,
                        hype_score, hype_change, hype_history
                    )
                `)
                .eq('team_id', teamData.id),
            // 4. Fetch details for all character picks
            supabase.from('character_picks')
                .select(`
                    pick_type,
                    character_id,
                    character_cache (
                        id, name, image, role, favorites, price
                    )
                `)
                .eq('team_id', teamData.id),
            // 5. Fetch most recent weekly score
            supabase.from('weekly_scores')
                .select('score')
                .eq('user_id', userId)
                .eq('season_id', targetSeason.id)
                .order('week_number', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        if (animePicksRes.error) throw animePicksRes.error;
        if (characterPicksRes.error) throw characterPicksRes.error;
        // weeklyScoreRes.error might be null if no score yet, that's fine.

        const animePicks = ((animePicksRes.data || []) as unknown as AnimePickRow[]).flatMap((pick) => {
            const anime = getSingleRelation(pick.anime_cache);
            if (!anime) {
                return [];
            }

            return {
                id: anime.id,
                title_romaji: anime.title_romaji,
                title_english: anime.title_english,
                cover_image: anime.cover_image,
                cost_kp: anime.cost_kp,
                hype_score: anime.hype_score || 0,
                hype_change: anime.hype_change || 0,
                genres: anime.genres,
                is_captain: teamData.captain_anime_id === anime.id,
                is_vice_captain: teamData.vice_captain_anime_id === anime.id,
                hype_history: Array.isArray(anime.hype_history) ? anime.hype_history : [],
            };
        });

        const characterPicks = ((characterPicksRes.data || []) as unknown as CharacterPickRow[]).flatMap((pick) => {
            const character = getSingleRelation(pick.character_cache);
            if (!character) {
                return [];
            }

            return {
                id: character.id,
                name: character.name,
                image: character.image,
                role: character.role,
                pick_type: pick.pick_type,
                favorites: character.favorites,
                price: character.price
            };
        });

        const animeCost = animePicks.reduce((sum, a) => sum + (a.cost_kp || 0), 0);
        const characterRawCost = characterPicks.reduce((sum, c) => sum + (c.price || 0), 0);
        const characterBoost = characterPicks.reduce((sum, c) => {
            const price = c.price || 0;
            if (c.pick_type === 'STAR_CHAR') return sum + price * 0.5;
            if (c.pick_type === 'WAIFU_HUSBANDO') return sum + price * 0.25;
            return sum;
        }, 0);

        const seasonBudgetCandidate =
          Number.isFinite(teamData.season_budget_kp) && (teamData.season_budget_kp ?? 0) > 0
            ? Number(teamData.season_budget_kp)
            : Math.max((teamData.remaining_kp ?? 0) + animeCost + characterRawCost, 20000);

        const calculatedRemaining = Math.max(0, seasonBudgetCandidate - animeCost - characterRawCost);
        const baselineRemaining = Number.isFinite(teamData.remaining_kp ?? 0)
          ? Number(teamData.remaining_kp)
          : calculatedRemaining;

        if (Math.abs(baselineRemaining - calculatedRemaining) > 1) {
            await supabase.from('teams').update({ remaining_kp: calculatedRemaining }).eq('id', teamData.id);
            await supabase.from('profiles').update({ total_kp: calculatedRemaining }).eq('id', teamData.user_id);
        }

        const isUpcomingSeason = (targetSeason?.status === 'upcoming') || (requestedSeasonId && requestedSeasonId === upcomingSeason?.id);

        const remainingToReport =
            Math.abs(baselineRemaining - calculatedRemaining) > 1
                ? calculatedRemaining
                : baselineRemaining;

        const responsePayload: SquadData = {
            team_id: teamData.id,
            user_id: teamData.user_id,
            season_id: teamData.season_id,
            remaining_kp: remainingToReport,
            remaining_kp_calculated: calculatedRemaining,
            transfers_used: teamData.transfers_used,
            free_transfers: teamData.free_transfers,
            captain_anime_id: teamData.captain_anime_id,
            vice_captain_anime_id: teamData.vice_captain_anime_id,
            anime_picks: animePicks,
            character_picks: characterPicks,
            team_value_base: animeCost,
            team_value_boost: characterBoost,
            team_value_total: animeCost + characterBoost,
            weekly_score: weeklyScoreRes.data?.score || null,
            current_week_number: isUpcomingSeason ? 0 : (targetSeason?.week_number ?? 0),
            locked_at: teamData.locked_at,
            locked_anime_at: teamData.locked_anime_at ?? teamData.locked_at ?? null,
            locked_characters_at: teamData.locked_characters_at ?? teamData.locked_at ?? null
        };

        return NextResponse.json(responsePayload);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error fetching squad data:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred.", details: message },
            { status: 500 }
        );
    }
}
