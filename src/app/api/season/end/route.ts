import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireServiceSecret } from '@/lib/service-auth';

const PAYOUT_PERCENT = 0.1;
const BADGE_BONUS: Record<string, number> = {
    shogun: 2500,
    platinum: 1500,
    gold: 800,
    silver: 400,
    bronze: 0
};
const RANK_BONUS: Record<number, number> = {
    1: 1200,
    2: 800,
    3: 500
};

// POST /api/season/end — finalise season, award badges, handle carry-over
export async function POST(request: Request) {
    const unauthorized = requireServiceSecret(request);
    if (unauthorized) {
        return unauthorized;
    }
    try {
        const { season_id, carry_over_budget_pct = 50, max_carry_kp = 3000 } = await request.json();
        if (!season_id) return NextResponse.json({ error: 'Missing season_id' }, { status: 400 });

        // 1. Get the season
        const { data: season } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('id', season_id)
            .single();

        if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

        // 2. Get the next upcoming season
        const { data: nextSeason } = await supabaseAdmin
            .from('seasons')
            .select('*')
            .eq('status', 'upcoming')
            .order('draft_opens_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        // 3. Award badges to all participants
        await supabaseAdmin.rpc('award_season_badges', { p_season_id: season_id });

        // 4. Handle budget carry-over
        const { data: teams } = await supabaseAdmin
            .from('teams')
            .select('id, user_id, remaining_kp, season_budget_kp, season_kp')
            .eq('season_id', season_id);

        const carryOverResults = [];

        for (const team of (teams || [])) {
            const unspent = team.remaining_kp ?? 0;
            const carryKp = Math.min(
                Math.floor(unspent * (carry_over_budget_pct / 100)),
                max_carry_kp
            );

            // If there's a next season, create a new team shell with carry-over budget
            if (nextSeason) {
                await supabaseAdmin.from('teams').upsert({
                    user_id: team.user_id,
                    season_id: nextSeason.id,
                    remaining_kp: 5000 + carryKp, // base budget + carry
                    season_budget_kp: 5000 + carryKp,
                    season_kp: 0,
                    week_number: 1,
                    free_transfers: 2,
                    transfers_used: 0,
                }, { onConflict: 'user_id,season_id' });
            }

            carryOverResults.push({ user_id: team.user_id, carry_kp: carryKp });
        }

        const { data: seasonScores } = await supabaseAdmin
            .from('season_scores')
            .select('user_id, total_season_kp, badge_tier, final_rank')
            .eq('season_id', season_id);

        const { data: existingPayouts } = await supabaseAdmin
            .from('season_payouts')
            .select('user_id')
            .eq('season_id', season_id);

        const alreadyPaid = new Set<string>((existingPayouts ?? []).map((entry) => entry.user_id));
        const candidateMap = new Map<string, {
            user_id: string;
            total_season_kp: number;
            badge_tier: string | null;
            final_rank: number | null;
        }>();

        (seasonScores ?? []).forEach((score) => {
            if (!score?.user_id) return;
            candidateMap.set(score.user_id, {
                user_id: score.user_id,
                total_season_kp: score.total_season_kp ?? 0,
                badge_tier: score.badge_tier ?? 'bronze',
                final_rank: score.final_rank ?? null
            });
        });

        (teams ?? []).forEach((team) => {
            if (!team?.user_id) return;
            if (candidateMap.has(team.user_id)) return;
            candidateMap.set(team.user_id, {
                user_id: team.user_id,
                total_season_kp: Number(team.season_kp ?? 0),
                badge_tier: 'bronze',
                final_rank: null
            });
        });

        const payoutResults = [];
        for (const candidate of Array.from(candidateMap.values()).sort((a, b) => (b.total_season_kp - a.total_season_kp))) {
            if (alreadyPaid.has(candidate.user_id)) continue;

            const base = Math.floor(candidate.total_season_kp * PAYOUT_PERCENT);
            const badgeBonus = BADGE_BONUS[(candidate.badge_tier ?? 'bronze').toLowerCase()] ?? 0;
            const rankBonus = candidate.final_rank ? (RANK_BONUS[candidate.final_rank] ?? 0) : 0;
            const award = Math.max(0, base + badgeBonus + rankBonus);

            if (award <= 0) continue;

            await supabaseAdmin.rpc('increment_kp', { user_id: candidate.user_id, amount: award });

            await supabaseAdmin.from('season_payouts').upsert({
                season_id,
                user_id: candidate.user_id,
                amount: award,
                badge_tier: candidate.badge_tier,
                final_rank: candidate.final_rank
            }, { onConflict: 'season_id, user_id' });

            payoutResults.push({
                user_id: candidate.user_id,
                amount: award,
                badge_tier: candidate.badge_tier,
                final_rank: candidate.final_rank
            });
        }

        // 5. Mark season as ended
        await supabaseAdmin
            .from('seasons')
            .update({ status: 'ended' })
            .eq('id', season_id);

        // 6. If next season draft is already open, activate it
        if (nextSeason) {
            const now = new Date();
            const draftOpens = nextSeason.draft_opens_at ? new Date(nextSeason.draft_opens_at) : null;
            if (draftOpens && now >= draftOpens) {
                await supabaseAdmin
                    .from('seasons')
                    .update({ status: 'active' })
                    .eq('id', nextSeason.id);
            }
        }

        return NextResponse.json({
            success: true,
            season_ended: season_id,
            next_season: nextSeason?.id ?? null,
            carry_overs: carryOverResults.length,
            details: carryOverResults,
            payout_awarded: payoutResults.length,
            total_payout_awarded: payoutResults.reduce((sum, row) => sum + row.amount, 0),
            payouts: payoutResults
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('Season end error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ message: 'POST to /api/season/end with { season_id }' });
}
