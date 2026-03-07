import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Define the shape of the aggregated profile data
export interface ProfileData {
  user: {
    id: string;
    username: string;
    avatar_url: string;
    tier: string;
    level: number;
    total_kp: number;
    created_at: string;
  };
  stats: {
    seasons_played: number;
    prediction_accuracy: number; // Percentage
    best_season_finish: number | null; // Rank
  };
  achievements: {
    id: string;
    name: string;
    description: string;
    icon: string; // Or a specific type for icons
    unlocked_at: string;
  }[];
  leagues: {
    id: string;
    name: string;
    // Potentially add user's rank in that league
  }[];
  // We'll add match history later to keep the initial load fast
  // match_history: any[]; 
}

type RouteParams = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id: userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // First, verify the user exists in auth and get their details
    const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(userId);

    if (authError || !authUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [
      profileRes,
      teamsRes,
      achievementsRes,
      leaguesRes,
      totalPredictionsRes,
      correctPredictionsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('teams').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('user_achievements').select('unlocked_at, achievements(id, name, description, icon)').eq('user_id', userId),
      supabase.from('league_members').select('leagues(id, name)').eq('user_id', userId),
      supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('predictions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_correct', true),
    ]);

    // 1. Construct user profile, falling back to defaults if 'profiles' row doesn't exist
    let userProfile;
    if (profileRes.data) {
      userProfile = {
        id: profileRes.data.id,
        username: profileRes.data.username || authUser.email?.split('@')[0] || 'New User',
        avatar_url: profileRes.data.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        tier: profileRes.data.tier || 'Bronze',
        level: profileRes.data.level || 1,
        total_kp: profileRes.data.total_kp || 0,
        created_at: authUser.created_at,
      };
    } else {
      // Create a default profile object for new users without a profiles entry
      userProfile = {
        id: userId,
        username: authUser.email?.split('@')[0] || 'New User',
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        tier: 'Bronze',
        level: 1,
        total_kp: 0,
        created_at: authUser.created_at,
      };
    }
    
    // 2. Fetch user stats
    const seasons_played = teamsRes.count ?? 0;
    
    const totalPredictions = totalPredictionsRes.count ?? 0;
    const correctPredictions = correctPredictionsRes.count ?? 0;
    const prediction_accuracy = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;

    const userStats = {
      seasons_played,
      prediction_accuracy,
      best_season_finish: null, // TODO: Implement a ranking system or a DB view to calculate this
    };

    // 3. Fetch unlocked achievements
    const userAchievements = (achievementsRes.data ?? [])
      .flatMap((row) => {
        const achievementsList = Array.isArray(row?.achievements) ? row.achievements : [];
        return achievementsList
          .filter(Boolean)
          .map((achievement) => ({
            id: achievement?.id ?? "",
            name: achievement?.name ?? "Achievement",
            description: achievement?.description ?? "",
            icon: achievement?.icon ?? "",
            unlocked_at: row?.unlocked_at ?? new Date().toISOString(),
          }));
      });

    // 4. Fetch user's leagues
    const userLeagues = (leaguesRes.data ?? [])
      .flatMap((row) => {
        const leaguesList = Array.isArray(row?.leagues) ? row.leagues : [];
        return leaguesList
          .filter(Boolean)
          .map((league) => ({
            id: league?.id ?? "",
            name: league?.name ?? "League",
          }));
      });

    const responsePayload: ProfileData = {
      user: userProfile,
      stats: userStats,
      achievements: userAchievements,
      leagues: userLeagues,
    };

    return NextResponse.json(responsePayload);

  } catch (error: unknown) {
    console.error("Error fetching profile data:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
