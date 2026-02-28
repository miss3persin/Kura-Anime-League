export type HeroContent = {
  visible?: boolean;
  headline?: string;
  subtitle?: string;
  cta?: string;
  ctaLink?: string;
};

export type AnnouncementContent = {
  visible?: boolean;
  message?: string;
  ctaLabel?: string;
  ctaLink?: string;
  tone?: "default" | "warning" | "accent";
};

export type DisplayConfig = {
  showTrendingHighlights?: boolean;
  showMarketPulse?: boolean;
  showPlaybook?: boolean;
  showLeaderboardPreview?: boolean;
  showSeasonTimeline?: boolean;
  disableWelcomeModal?: boolean;
};

export type AdminPoll = {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  votes_a: number;
  votes_b: number;
  is_active: boolean;
  created_at?: string | null;
};
