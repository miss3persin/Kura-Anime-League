export type PredictionFilterType = "upcoming" | "active_bets" | "past_bets";

export interface PredictionOption {
  label: string;
  value: string;
  odds: number;
}

export interface PredictionEvent {
  id: string;
  season_id: string;
  week_number: number;
  anime_id: number | null;
  title: string;
  description: string;
  prediction_type: string;
  options: PredictionOption[];
  deadline: string;
  is_resolved: boolean;
  correct_option_value: string | null;
  anime_cover_image: string | null;
  anime_title_english: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserPrediction {
  id: string;
  user_id: string;
  chosen_option_value: string;
  kp_wager: number;
  wager_date: string;
  is_correct: boolean | null;
  kp_earned: number | null;
  prediction_event: PredictionEvent;
}

export interface PredictionsData {
  total_kp: number;
  upcoming_events: PredictionEvent[];
  active_user_predictions: UserPrediction[];
  past_user_predictions: UserPrediction[];
  message?: string;
}

export interface AdminPredictionEventInput {
  seasonId: string;
  weekNumber: number;
  animeId: number | null;
  title: string;
  description: string;
  predictionType: string;
  options: PredictionOption[];
  deadline: string;
  isActive: boolean;
  isResolved: boolean;
  correctOptionValue: string | null;
}
