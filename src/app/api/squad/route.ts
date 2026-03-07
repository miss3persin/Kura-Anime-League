import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { type AnimeHypeHistoryEntry } from "@/lib/hype";

export const dynamic = 'force-dynamic';

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
    } | {
        id: number;
        name: string;
        image: string;
        role: string;
        favorites?: number;
    }[];
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
    remaining_kp: number;
    transfers_used: number;
    free_transfers: number;
    captain_anime_id: number | null;
    vice_captain_anime_id: number | null;
    anime_picks: SquadAnimePick[];
    character_picks: SquadCharacterPick[];
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

    if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        const supabase = getSupabaseAdmin();

        // 1. Get active season ID
        const { data: activeSeason, error: seasonError } = await supabase
            .from('seasons')
            .select('id, week_number')
            .eq('status', 'active')
            .single();

        if (seasonError || !activeSeason) {
            return NextResponse.json(
                {
                    squadData: null,
                    code: 'NO_ACTIVE_SEASON',
                    message: "There is no active season right now."
                } satisfies SquadEmptyResponse,
                { status: 200 }
            );
        }

        // 2. Fetch team data for the user and active season
        const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('user_id', userId)
            .eq('season_id', activeSeason.id)
            .maybeSingle();

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
                        id, name, image, role, favorites
                    )
                `)
                .eq('team_id', teamData.id),
            // 5. Fetch most recent weekly score
            supabase.from('weekly_scores')
                .select('score')
                .eq('user_id', userId)
                .eq('season_id', activeSeason.id)
                .order('week_number', { ascending: false })
                .limit(1)
                .single(),
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
            };
        });

        const responsePayload: SquadData = {
            team_id: teamData.id,
            user_id: teamData.user_id,
            season_id: teamData.season_id,
            remaining_kp: teamData.remaining_kp,
            transfers_used: teamData.transfers_used,
            free_transfers: teamData.free_transfers,
            captain_anime_id: teamData.captain_anime_id,
            vice_captain_anime_id: teamData.vice_captain_anime_id,
            anime_picks: animePicks,
            character_picks: characterPicks,
            weekly_score: weeklyScoreRes.data?.score || null,
            current_week_number: activeSeason.week_number,
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
