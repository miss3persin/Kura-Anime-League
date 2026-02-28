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
    };
    bannerImage?: string | null;
    description?: string | null;
    format?: string | null;
    episodes?: number | null;
    averageScore?: number | null;
    genres?: string[] | null;
    status?: string | null;
    characters?: {
        nodes?: AniListCharacter[];
    };
}

export async function determineSeasonContext(): Promise<SeasonContext> {
    const { data: rawCurrentSeason } = await supabaseAdmin
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .single();

    const { data: rawUpcomingSeason } = await supabaseAdmin
        .from('seasons')
        .select('*')
        .eq('status', 'upcoming')
        .order('draft_opens_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    const targetSeason = (rawCurrentSeason ?? rawUpcomingSeason) as SeasonRecord | null;
    const derivedLabel =
        extractSeasonLabelFromName(targetSeason?.name) ??
        seasonLabelFromDate(targetSeason?.draft_opens_at ?? targetSeason?.start_date);
    const seasonYear = extractSeasonYear(targetSeason);
    const seasonName = targetSeason?.name ?? `${derivedLabel} ${seasonYear}`;
    const seasonId = parseSeasonId(targetSeason?.id);

    return {
        label: derivedLabel,
        year: seasonYear,
        seasonName,
        seasonId,
        seasonRecord: targetSeason
    };
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
    return {
        id: anime.id,
        title_romaji: anime.title?.romaji ?? null,
        title_english: anime.title?.english ?? null,
        cover_image: anime.coverImage?.extraLarge ?? anime.coverImage?.large ?? null,
        banner_image: anime.bannerImage ?? null,
        description: anime.description ?? null,
        format: anime.format ?? null,
        episodes: anime.episodes ?? null,
        average_score: anime.averageScore ?? null,
        genres: anime.genres ?? null,
        status: anime.status ?? 'NOT_YET_RELEASED',
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
    const now = new Date().toISOString();
    return (anime.characters?.nodes ?? []).map((char) => ({
        id: char.id,
        anime_id: anime.id,
        name: char.name.full,
        image: char.image.large,
        role: 'MAIN',
        updated_at: now
    }));
}
