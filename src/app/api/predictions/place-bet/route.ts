import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizePredictionOptions } from "@/lib/predictions";

export const dynamic = 'force-dynamic';

type PredictionEventContext = {
    id: string;
    season_id: string;
    week_number: number;
    prediction_type: string;
    anime_id: number | null;
    options: unknown;
    deadline: string;
    is_active: boolean;
    is_resolved: boolean;
};

export async function POST(request: NextRequest) {
    const { userId, eventId, chosenOptionValue, wagerAmount } = await request.json();

    if (!userId || !eventId || !chosenOptionValue || wagerAmount === undefined || wagerAmount <= 0) {
        return NextResponse.json(
            { error: "Missing required fields or invalid wager amount." },
            { status: 400 }
        );
    }

    try {
        const supabase = getSupabaseAdmin();

        // 1. Fetch user's current KP balance and check if they have enough
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('total_kp')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "User profile not found.", details: profileError?.message }, { status: 404 });
        }

        if (profile.total_kp < wagerAmount) {
            return NextResponse.json({ error: "Insufficient KuraPoints for this wager." }, { status: 400 });
        }

        const { data: event, error: eventError } = await supabase
            .from('prediction_events')
            .select('id, season_id, week_number, prediction_type, anime_id, options, deadline, is_active, is_resolved')
            .eq('id', eventId)
            .maybeSingle();

        if (eventError || !event) {
            return NextResponse.json({ error: "Prediction event not found.", details: eventError?.message }, { status: 404 });
        }

        const predictionEvent = event as PredictionEventContext;
        if (!predictionEvent.is_active || predictionEvent.is_resolved) {
            return NextResponse.json({ error: "This prediction event is no longer open." }, { status: 400 });
        }

        if (new Date(predictionEvent.deadline).getTime() <= Date.now()) {
            return NextResponse.json({ error: "The deadline for this prediction has passed." }, { status: 400 });
        }

        const eventOptions = normalizePredictionOptions(predictionEvent.options, predictionEvent.prediction_type);

        const isValidOption = eventOptions.some(opt => opt.value === chosenOptionValue);
        if (!isValidOption) {
            return NextResponse.json({ error: "Chosen option is not valid for this prediction event type.", details: `Valid options are: ${eventOptions.map(o => o.value).join(', ')}` }, { status: 400 });
        }

        // 3. Deduct KP and store the prediction using the current table schema.
        const { error: balanceError } = await supabase
            .from('profiles')
            .update({ total_kp: profile.total_kp - wagerAmount })
            .eq('id', userId);

        if (balanceError) {
            return NextResponse.json({ error: "Failed to update KP balance.", details: balanceError.message }, { status: 500 });
        }

        const { error: insertError } = await supabase
            .from('predictions')
            .insert({
                user_id: userId,
                event_id: predictionEvent.id,
                season_id: predictionEvent.season_id,
                week_number: predictionEvent.week_number,
                prediction_type: predictionEvent.prediction_type,
                anime_id: predictionEvent.anime_id,
                predicted_value: chosenOptionValue,
                kp_wager: wagerAmount,
            });

        if (insertError) {
            if (
                insertError.code === '23505' ||
                insertError.message.includes('duplicate key value violates unique constraint') ||
                insertError.message.includes('predictions_user_event_key')
            ) {
                await supabase
                    .from('profiles')
                    .update({ total_kp: profile.total_kp })
                    .eq('id', userId);
                return NextResponse.json(
                    { error: "You have already placed a prediction for this event." },
                    { status: 409 }
                );
            }

            await supabase
                .from('profiles')
                .update({ total_kp: profile.total_kp })
                .eq('id', userId);

            return NextResponse.json({ error: "Failed to place prediction.", details: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Prediction placed successfully." }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error placing prediction:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "An unexpected error occurred.", details: message },
            { status: 500 }
        );
    }
}
