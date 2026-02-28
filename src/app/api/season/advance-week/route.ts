import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireServiceSecret } from '@/lib/service-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/season/advance-week — increments the week counter + resets transfers
export async function POST(request: Request) {
    const unauthorized = requireServiceSecret(request);
    if (unauthorized) {
        return unauthorized;
    }
    try {
        const { season_id } = await request.json();
        if (!season_id) return NextResponse.json({ error: 'Missing season_id' }, { status: 400 });

        const { data: season } = await supabaseAdmin
            .from('seasons')
            .select('week_number, total_weeks')
            .eq('id', season_id)
            .single();

        if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

        const newWeek = (season.week_number ?? 1) + 1;

        // Advance week number
        await supabaseAdmin
            .from('seasons')
            .update({ week_number: newWeek })
            .eq('id', season_id);

        // Reset free transfers for all teams in this season
        await supabaseAdmin
            .from('teams')
            .update({ transfers_used: 0, week_number: newWeek })
            .eq('season_id', season_id);

        return NextResponse.json({ success: true, new_week: newWeek, total_weeks: season.total_weeks });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ message: 'POST to /api/season/advance-week with { season_id }' });
}
