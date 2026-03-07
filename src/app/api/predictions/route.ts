import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mapPredictionEventRow } from "@/lib/predictions";
import type {
    PredictionEvent,
    PredictionsData,
    UserPrediction,
} from "@/lib/types/predictions";

export const dynamic = 'force-dynamic';

type PredictionQueryRow = {
    id: string;
    predicted_value: string;
    kp_wager: number;
    created_at: string;
    is_correct: boolean | null;
    kp_earned: number | null;
    anime_id: number | null;
    event_id: string | null;
    season_id: string;
    week_number: number;
    prediction_type: string;
    is_resolved: boolean;
    prediction_event?: {
        id: string;
        season_id: string;
        week_number: number;
        anime_id: number | null;
        title: string;
        description: string | null;
        prediction_type: string;
        options: unknown;
        deadline: string;
        is_resolved: boolean;
        is_active?: boolean | null;
        correct_option_value: string | null;
        created_at?: string;
        updated_at?: string;
        anime?:
            | {
                title_romaji?: string | null;
                title_english?: string | null;
                cover_image?: string | null;
            }
            | Array<{
                title_romaji?: string | null;
                title_english?: string | null;
                cover_image?: string | null;
            }>
            | null;
    } | Array<{
        id: string;
        season_id: string;
        week_number: number;
        anime_id: number | null;
        title: string;
        description: string | null;
        prediction_type: string;
        options: unknown;
        deadline: string;
        is_resolved: boolean;
        is_active?: boolean | null;
        correct_option_value: string | null;
        created_at?: string;
        updated_at?: string;
        anime?:
            | {
                title_romaji?: string | null;
                title_english?: string | null;
                cover_image?: string | null;
            }
            | Array<{
                title_romaji?: string | null;
                title_english?: string | null;
                cover_image?: string | null;
            }>
            | null;
    }> | null;
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        const supabase = getSupabaseAdmin();

        // 1. Get user's total KP
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('total_kp')
            .eq('id', userId)
            .single();

        if (profileError) {
            return NextResponse.json({ error: "Profile not found.", details: profileError.message }, { status: 404 });
        }
        const total_kp = profileData?.total_kp || 0;

        // 2. Get active season ID and current week
        const { data: activeSeason, error: seasonError } = await supabase
            .from('seasons')
            .select('id, week_number')
            .eq('status', 'active')
            .single();

        if (seasonError || !activeSeason) {
            // If no active season, user might not have predictions yet or it's offseason
            return NextResponse.json(
                { total_kp, upcoming_events: [], active_user_predictions: [], past_user_predictions: [], message: "No active season found for predictions." },
                { status: 200 }
            );
        }

        const activeSeasonId = activeSeason.id;

        const { data: managedEvents, error: managedEventsError } = await supabase
            .from('prediction_events')
            .select(`
                id, season_id, week_number, anime_id, title, description, prediction_type,
                options, deadline, is_resolved, is_active, correct_option_value, created_at, updated_at,
                anime:anime_cache(title_romaji, title_english, cover_image)
            `)
            .eq('season_id', activeSeasonId)
            .eq('is_active', true)
            .order('deadline', { ascending: true });

        if (managedEventsError) throw managedEventsError;

        const upcoming_events: PredictionEvent[] = (managedEvents ?? [])
            .map((event) => mapPredictionEventRow(event as Parameters<typeof mapPredictionEventRow>[0]))
            .filter((event) => !event.is_resolved && new Date(event.deadline).getTime() > Date.now());

        // --- Fetch User's Predictions ---
        const { data: userPredictionsRes, error: userPredictionsError } = await supabase
            .from('predictions')
            .select(`
                id, predicted_value, kp_wager, created_at, is_correct, kp_earned,
                anime_id, event_id, season_id, week_number, prediction_type, predicted_value, is_resolved,
                prediction_event:prediction_events(
                    id, season_id, week_number, anime_id, title, description, prediction_type,
                    options, deadline, is_resolved, is_active, correct_option_value, created_at, updated_at,
                    anime:anime_cache(title_romaji, title_english, cover_image)
                )
            `)
            .eq('user_id', userId)
            .eq('season_id', activeSeasonId)
            .order('created_at', { ascending: false });
        
        if (userPredictionsError) throw userPredictionsError;

        const userPredictions: UserPrediction[] = ((userPredictionsRes || []) as unknown as PredictionQueryRow[]).map((pred) => {
            const eventSource = Array.isArray(pred.prediction_event) ? pred.prediction_event[0] : pred.prediction_event;
            const event: PredictionEvent = eventSource
                ? mapPredictionEventRow(eventSource)
                : {
                    id: pred.event_id ?? pred.id,
                    season_id: pred.season_id,
                    week_number: pred.week_number,
                    anime_id: pred.anime_id,
                    title: `Prediction event unavailable (${pred.prediction_type})`,
                    description: `Type: ${pred.prediction_type}`,
                    prediction_type: pred.prediction_type,
                    options: [],
                    deadline: pred.created_at,
                    is_resolved: pred.is_resolved,
                    correct_option_value: null,
                    anime_cover_image: null,
                    anime_title_english: null,
                };

            return {
                id: pred.id,
                user_id: userId,
                chosen_option_value: pred.predicted_value,
                kp_wager: pred.kp_wager,
                wager_date: pred.created_at,
                is_correct: pred.is_correct,
                kp_earned: pred.kp_earned,
                prediction_event: event,
            };
        });

        const active_user_predictions = userPredictions.filter(p => p.prediction_event.is_resolved === false);
        const past_user_predictions = userPredictions.filter(p => p.prediction_event.is_resolved === true);

        const responsePayload: PredictionsData = {
            total_kp,
            upcoming_events,
            active_user_predictions,
            past_user_predictions,
        };

        return NextResponse.json(responsePayload);

    } catch (error: unknown) {
        console.error("Error fetching predictions data:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { error: "An unexpected error occurred.", details: message },
            { status: 500 }
        );
    }
}
