import { supabaseAdmin } from './supabase/admin';
import { fetchAniList, GET_SEASONAL_ANIME, AniListCharacter, AniListSeasonalResponse } from './anilist';

const VALID_SEASON_LABELS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const;
type SeasonLabel = (typeof VALID_SEASON_LABELS)[number];

const isUuid = (value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const parseSeasonId = (value: number | string | null | undefined): number | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
};

const extractSeasonLabelFromName = (name?: string | null): SeasonLabel | null => {
    if (!name) return null;
    const upperName = name.toUpperCase();
    for (const label of VALID_SEASON_LABELS) {
        if (upperName.includes(label)) return label;
    }
    return null;
};

const seasonLabelFromDate = (value?: string | null): SeasonLabel => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return 'WINTER';
    const month = date.getMonth();
    if (month >= 3 && month <= 5) return 'SPRING';
    if (month >= 6 && month <= 8) return 'SUMMER';
    if (month >= 9 && month <= 11) return 'FALL';
    return 'WINTER';
};

const extractSeasonYear = (season?: { name?: string | null; draft_opens_at?: string | null; start_date?: string | null }) => {
    const yearFromName = season?.name ? /\b(20\d{2})\b/.exec(season.name)?.[1] : null;
    if (yearFromName) return parseInt(yearFromName);
    const dateSource = season?.draft_opens_at ?? season?.start_date;
    if (dateSource) {
        const parsed = new Date(dateSource);
        if (!Number.isNaN(parsed.getFullYear())) return parsed.getFullYear();
    }
    return new Date().getFullYear();
};

interface SeasonRecord {
    id: string | number;
    name: string | null;
    status: string;
    draft_opens_at: string | null;
    start_date: string | null;
}

export interface SeasonContext {
    label: SeasonLabel;
    year: number;
    seasonName: string;
    seasonId: number | null;
    seasonRecord: SeasonRecord | null;
}

export interface SeasonalAnimeEntry {
    id: number;
    title: {
        romaji?: string | null;
        english?: string | null;
        native?: string | null;
    };
    coverImage: {
        extraLarge?: string | null;
        large?: string | null;
        medium?: string | null;
    };
    bannerImage?: string | null;
    description?: string | null;
    format?: string | null;
    episodes?: number | null;
    averageScore?: number | null;
    genres?: string[] | null;
    status?: string | null;
    isAdult?: boolean | null;
    popularity?: number | null;
    characters?: {
        nodes?: AniListCharacter[];
    };
}

export async function determineSeasonContexts(): Promise<SeasonContext[]> {
    const { data: seasons } = await supabaseAdmin
        .from('seasons')
        .select('*')
        .in('status', ['active', 'upcoming'])
        .order('status', { ascending: true }); // 'active' comes before 'upcoming' lexicographically but let's be careful.

    if (!seasons || seasons.length === 0) {
        return [];
    }

    return (seasons as SeasonRecord[]).map((s) => {
        const derivedLabel =
            extractSeasonLabelFromName(s.name) ??
            seasonLabelFromDate(s.draft_opens_at ?? s.start_date);
        const seasonYear = extractSeasonYear(s);
        const seasonName = s.name ?? `${derivedLabel} ${seasonYear}`;
        const seasonId = parseSeasonId(s.id);

        return {
            label: derivedLabel,
            year: seasonYear,
            seasonName,
            seasonId,
            seasonRecord: s
        };
    });
}

export async function fetchSeasonalAnimeList(context: SeasonContext, perPage = 50): Promise<SeasonalAnimeEntry[]> {
    const results: SeasonalAnimeEntry[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const { data } = await fetchAniList<AniListSeasonalResponse>(
            GET_SEASONAL_ANIME,
            {
                season: context.label,
                seasonYear: context.year,
                page,
                perPage
            },
            {
                endpoint: 'seasonal-sync',
                metadata: { page, perPage }
            }
        );

        const pageMedia = data.Page.media;
        results.push(...pageMedia);
        hasNextPage = data.Page.pageInfo?.hasNextPage ?? false;
        if (!hasNextPage) break;
        page += 1;
    }

    return results;
}

export function buildAnimeCachePayload(anime: SeasonalAnimeEntry, context: SeasonContext) {
    // League Eligibility Logic:
    // 1. No Adult/Hentai (isAdult)
    // 2. No ONAs (Often short/irregular)
    // 3. High Popularity "Auto-Ban" for drafting (e.g. > 100k members) 
    // This forces users to draft "undervalued" shows rather than just sequels.
    const isAdult = anime.isAdult ?? false;
    const isONA = anime.format === 'ONA';
    const isOverHyped = (anime.popularity ?? 0) > 100000;
    const isEligible = !isAdult && !isONA && !isOverHyped;

    return {
        id: anime.id,
        title_romaji: anime.title?.romaji ?? null,
        title_english: anime.title?.english ?? null,
        // High Resolution Strategy: Prefer extraLarge (typically 460x650)
        cover_image: anime.coverImage?.extraLarge ?? anime.coverImage?.large ?? null,
        banner_image: anime.bannerImage ?? null,
        description: anime.description ?? null,
        format: anime.format ?? null,
        episodes: anime.episodes ?? null,
        average_score: anime.averageScore ?? null,
        genres: anime.genres ?? null,
        status: anime.status ?? 'NOT_YET_RELEASED',
        is_adult: isAdult,
        is_eligible: isEligible,
        popularity: anime.popularity ?? 0,
        season_id: context.seasonId,
        season_uuid:
            typeof context.seasonRecord?.id === 'string' && isUuid(context.seasonRecord.id)
                ? context.seasonRecord.id
                : null,
        season_name: context.seasonRecord?.name ?? null,
        updated_at: new Date().toISOString()
    };
}

export function buildCharacterPayloads(anime: SeasonalAnimeEntry) {
    if (!anime.characters?.nodes) return [];

    // Curate: Sort by favourites descending and take top 2 to avoid clutter
    const topCharacters = [...anime.characters.nodes]
        .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))
        .slice(0, 2);

    const now = new Date().toISOString();
    return topCharacters
        .filter(char => char.gender === 'Female' || char.gender === 'Male') // Exclude NULL/Other
        .map((char) => {
            // Determine role/gender label
            const role = char.gender === 'Female' ? 'Waifu' : 'Husbando';
            
            // Calculate Price: Base 1000 + (Favorites / 10) capped at 5000
            const popularityBonus = Math.floor((char.favourites ?? 0) / 10);
            const price = Math.min(5000, 1000 + popularityBonus);

            return {
                id: char.id,
                anime_id: anime.id,
                name: char.name.full,
                image: char.image.large,
                role: role,
                gender: char.gender,
                favorites: char.favourites ?? 0,
                price: price,
                about: char.description ?? null,
                updated_at: now
            };
        });
}
