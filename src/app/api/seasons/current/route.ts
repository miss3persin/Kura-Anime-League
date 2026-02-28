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

function parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function derivePhase(season: any, now: Date): {
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
        return { phase: 'pre_draft', deadline: season.draft_opens_at, deadlineLabel: 'Draft Opens' };
    }
    if (draftCloses && now < draftCloses) {
        return { phase: 'draft_open', deadline: season.draft_closes_at, deadlineLabel: 'Draft Closes' };
    }
    if (seasonEnd && now < seasonEnd) {
        return { phase: 'season_live', deadline: season.end_date, deadlineLabel: 'Season Ends' };
    }
    if (reviewEnds && now < reviewEnds) {
        return { phase: 'transfer_review', deadline: season.transfer_review_ends_at, deadlineLabel: 'Transfer Review Closes' };
    }

    return { phase: 'ended', deadline: null, deadlineLabel: null };
}

// GET /api/seasons/current — returns active season status, phase, and countdown info
export async function GET() {
    try {
        const now = new Date();

        const { data: activeSeason } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('status', 'active')
            .single();

        const { data: upcomingSeason } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('status', 'upcoming')
            .order('draft_opens_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (activeSeason) {
            const { phase, deadline, deadlineLabel } = derivePhase(activeSeason, now);
            return NextResponse.json({
                phase,
                deadline,
                deadlineLabel,
                activeSeason,
                upcomingSeason,
                currentWeek: activeSeason.week_number ?? 1,
                totalWeeks: activeSeason.total_weeks ?? 12
            });
        }

        if (upcomingSeason) {
            const { phase, deadline, deadlineLabel } = derivePhase(upcomingSeason, now);
            return NextResponse.json({
                phase,
                deadline,
                deadlineLabel,
                activeSeason: upcomingSeason,
                upcomingSeason,
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
            currentWeek: 0,
            totalWeeks: 0
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
