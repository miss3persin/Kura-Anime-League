import { NextResponse } from 'next/server';
import { runRefreshCycle } from '@/lib/refreshCycle';
import { requireServiceSecret } from '@/lib/service-auth';
import { serviceFetch } from '@/lib/service-client';

export async function GET(request: Request) {
    const unauthorized = requireServiceSecret(request);
    if (unauthorized) return unauthorized;

    const result = await runRefreshCycle();

    if (result.success) {
        try {
            await serviceFetch('/api/hype');
        } catch (e) {
            console.error('Initial hype trigger failed', e);
        }

        return NextResponse.json({
            message: `Refresh cycle completed with ${result.steps.length} steps`,
            result
        });
    } else {
        return NextResponse.json({
            error: 'Failed to run refresh cycle'
        }, { status: 500 });
    }
}
