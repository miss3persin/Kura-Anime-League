import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SeasonPhase =
    | 'pre_draft'
    | 'draft_open'
    | 'season_live'
    | 'transfer_review'
    | 'ended'
    | 'off_season';

interface SeasonData {
    draft_opens_at?: string | null;
    draft_closes_at?: string | null;
    end_date?: string | null;
    transfer_review_ends_at?: string | null;
    week_number?: number | null;
    total_weeks?: number | null;
    name?: string | null;
}

function parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function derivePhase(season: SeasonData | null, now: Date): {
    phase: SeasonPhase;
    deadline: string | null;
    deadlineLabel: string | null;
} {
    if (!season) {
        return { phase: 'off_season', deadline: null, deadlineLabel: null };
    }

    const draftOpens = parseDate(season.draft_opens_at);
    const draftCloses = parseDate(season.draft_closes_at);
    const seasonEnd = parseDate(season.end_date);
    const reviewEnds = parseDate(season.transfer_review_ends_at);

    if (draftOpens && now < draftOpens) {
        return { phase: 'pre_draft', deadline: season.draft_opens_at ?? null, deadlineLabel: 'Draft Opens' };
    }
    if (draftCloses && now < draftCloses) {
        return { phase: 'draft_open', deadline: season.draft_closes_at ?? null, deadlineLabel: 'Draft Closes' };
    }
    if (seasonEnd && now < seasonEnd) {
        return { phase: 'season_live', deadline: season.end_date ?? null, deadlineLabel: 'Season Ends' };
    }
    if (reviewEnds && now < reviewEnds) {
        return { phase: 'transfer_review', deadline: season.transfer_review_ends_at ?? null, deadlineLabel: 'Transfer Review Closes' };
    }

    return { phase: 'ended', deadline: null, deadlineLabel: null };
}

// GET /api/seasons/current — returns active season status, phase, and countdown info
export async function GET() {
    try {
        const now = new Date();

        const { data: rawActiveSeason } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('status', 'active')
            .maybeSingle();

        const activeSeason = rawActiveSeason as SeasonData | null;

        const { data: rawUpcomingSeason } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('status', 'upcoming')
            .order('draft_opens_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        const upcomingSeason = rawUpcomingSeason as SeasonData | null;

        const activePhase = derivePhase(activeSeason, now);
        const upcomingPhase = derivePhase(upcomingSeason, now);

        // If the upcoming season's draft is open, that takes precedence for the "drafting" phase
        if (upcomingPhase.phase === 'draft_open') {
            return NextResponse.json({
                phase: 'draft_open',
                deadline: upcomingPhase.deadline,
                deadlineLabel: upcomingPhase.deadlineLabel,
                activeSeason: activeSeason, // Still return active for live tracking
                upcomingSeason,
                draftSeason: upcomingSeason,
                currentWeek: activeSeason?.week_number ?? 0,
                totalWeeks: activeSeason?.total_weeks ?? 12
            });
        }

        if (activeSeason) {
            return NextResponse.json({
                ...activePhase,
                activeSeason,
                upcomingSeason,
                draftSeason: activeSeason,
                currentWeek: activeSeason.week_number ?? 1,
                totalWeeks: activeSeason.total_weeks ?? 12
            });
        }

        if (upcomingSeason) {
            return NextResponse.json({
                ...upcomingPhase,
                activeSeason: null,
                upcomingSeason,
                draftSeason: upcomingSeason,
                currentWeek: upcomingSeason.week_number ?? 0,
                totalWeeks: upcomingSeason.total_weeks ?? 12
            });
        }

        return NextResponse.json({
            phase: 'off_season' as SeasonPhase,
            deadline: null,
            deadlineLabel: null,
            activeSeason: null,
            upcomingSeason: null,
            draftSeason: null,
            currentWeek: 0,
            totalWeeks: 0
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
