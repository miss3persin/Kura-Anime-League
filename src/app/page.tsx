"use client";

import React, { useEffect, useState } from "react";
import type { AnnouncementContent, DisplayConfig, HeroContent } from "@/types/content";
import { AppShell } from "@/components/ui/app-shell";
import { NeonButton } from "@/components/ui/neon-button";
import { TrendingUp, TrendingDown, Loader2, ChevronLeft, ChevronRight, X, Swords, Trophy, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { SeasonPhaseBanner } from "@/components/ui/season-banner";
import { Modal } from "@/components/ui/modal";
import { useSeasonTimeline } from "@/lib/hooks/useSeasonTimeline";

import { getHistoryChange, AnimeHypeHistoryEntry } from '@/lib/hype';

interface Anime {
  id: number;
  title_romaji: string;
  title_english: string;
  cover_image: string;
  banner_image: string;
  external_banner_url?: string | null;
  description: string;
  cost_kp: number;
  hype_change: number;
  hype_history?: AnimeHypeHistoryEntry[];
}

const DEFAULT_HERO_CONTENT: HeroContent = {
  visible: true,
  headline: "KAL Spring 2026",
  subtitle: "The new season starts April 1, 2026",
  cta: "View draft",
  ctaLink: "/draft"
};

const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  showTrendingHighlights: true,
  showMarketPulse: true,
  showPlaybook: true,
  showLeaderboardPreview: true,
  showSeasonTimeline: true,
  disableWelcomeModal: false
};

type AnnouncementTone = NonNullable<AnnouncementContent["tone"]>;

const DEFAULT_ANNOUNCEMENT: AnnouncementContent = {
  visible: false,
  message: "",
  ctaLabel: "",
  ctaLink: "",
  tone: "default"
};

const ANNOUNCEMENT_TONE_CLASSES: Record<AnnouncementTone, string> = {
  default: "border-white/10 bg-white/5 text-white/80",
  accent: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  warning: "border-red-500/40 bg-red-500/10 text-red-100"
};

export default function Home() {
  const router = useRouter();
  const { seasonInfo } = useSeasonTimeline();
  const [carouselAnime, setCarouselAnime] = useState<Anime[]>([]);
  const [trendingShows, setTrendingShows] = useState<Anime[]>([]);
  const [marketPulseAnime, setMarketPulseAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [heroContent, setHeroContent] = useState<HeroContent>(DEFAULT_HERO_CONTENT);
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
  const [announcement, setAnnouncement] = useState<AnnouncementContent>(DEFAULT_ANNOUNCEMENT);

  const showTrending = displayConfig.showTrendingHighlights ?? true;
  const showMarketPulse = displayConfig.showMarketPulse ?? true;
  const showPlaybook = displayConfig.showPlaybook ?? true;
  const showLeaderboard = displayConfig.showLeaderboardPreview ?? true;
  const showTimelineEntries = displayConfig.showSeasonTimeline ?? true;
  const disableWelcomeModal = displayConfig.disableWelcomeModal ?? false;
  const announcementToneClass = ANNOUNCEMENT_TONE_CLASSES[announcement.tone ?? "default"];

  useEffect(() => {
    const fetchData = async () => {
      if (!seasonInfo) return;
      setLoading(true);
      try {
        // Target Season Logic: Prioritize upcoming/draft season for main content
        const targetSeasonId = seasonInfo.draftSeason?.id || seasonInfo.upcomingSeason?.id || seasonInfo.activeSeason?.id;
        // 1. Fetch Main Content (Carousel & Trending) - focused on the "Target" season
        let mainQuery = supabase.from('anime_cache').select('*');
        if (targetSeasonId) {
          mainQuery = mainQuery.eq('season_uuid', targetSeasonId);
        }
        const { data: mainData, error: mainError } = await mainQuery
          .limit(30)
          .order('hype_score', { ascending: false });

        if (mainError) throw mainError;

        const pulseResponse = await fetch('/api/market?sort=change&direction=desc&limit=10', {
          cache: 'no-store'
        });
        const pulsePayload = await pulseResponse.json().catch(() => ({}));
        if (!pulseResponse.ok) {
          throw new Error(`Market API error: ${pulsePayload.error || pulseResponse.statusText}`);
        }
        const pulseData = Array.isArray(pulsePayload.items) ? pulsePayload.items : [];

        if (mainData) {
          // Filter for shows that actually have a banner. If none, we use posters.
          const withBanners = mainData.filter(a => a.banner_image || a.external_banner_url);
          // If we have at least 3 shows with banners, use the banner-only list for carousel
          // Otherwise, use the top 10 shows regardless of banner status (fallback to posters)
          setCarouselAnime(withBanners.length >= 3 ? withBanners.slice(0, 10) : mainData.slice(0, 10));
          setTrendingShows(mainData.slice(0, 12));
        }
        if (pulseData) {
            setMarketPulseAnime(pulseData);
        }
        
        setDbError(null);
      } catch (err: unknown) {
        let message = "System initialization error.";
        if (err instanceof Error) {
            message = err.message;
            console.error('Detailed Debug Info:', JSON.stringify({
                message: err.message,
                stack: err.stack,
            }, null, 2));
        }
        setDbError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [seasonInfo]);

  useEffect(() => {
    if (disableWelcomeModal) {
      setShowWelcomeModal(false);
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active || session) return;
        if (!sessionStorage.getItem("kal_welcomed")) {
          sessionStorage.setItem("kal_welcomed", "1");
          timer = setTimeout(() => {
            if (active) {
              setShowWelcomeModal(true);
            }
          }, 1500);
        }
      } catch (error: unknown) {
        console.error("Failed to verify session for welcome modal", error);
      }
    };
    checkAuth();
    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [disableWelcomeModal]);

  useEffect(() => {
    let active = true;
    const loadContent = async () => {
      try {
        const res = await fetch("/api/content");
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        const nextHero = { ...DEFAULT_HERO_CONTENT, ...(data?.hero ?? {}) };
        setHeroContent(nextHero);
        setDisplayConfig({ ...DEFAULT_DISPLAY_CONFIG, ...(data?.config ?? {}) });
        setAnnouncement({ ...DEFAULT_ANNOUNCEMENT, ...(data?.announcement ?? {}) });
      } catch (error: unknown) {
        console.error("Failed to load site content", error);
      }
    };
    loadContent();
    return () => {
      active = false;
    };
  }, []);

  // Auto-slide carousel
  useEffect(() => {
    if (carouselAnime.length === 0) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % carouselAnime.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [carouselAnime.length]);

  const nextSlide = () => setActiveIndex(prev => (prev + 1) % carouselAnime.length);
  const prevSlide = () => setActiveIndex(prev => (prev - 1 + carouselAnime.length) % carouselAnime.length);

  const [topPerformers, setTopPerformers] = useState<{ rank: number; name: string; kp: string; avatar: string }[]>([]);
  const [topCharacters, setTopCharacters] = useState<{ id: number; name: string; image: string; role: string; favorites: number; about?: string; anime_title?: string; price: number; gender?: string }[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<typeof topCharacters[0] | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, total_kp, avatar_url')
          .order('total_kp', { ascending: false })
          .limit(4);

        if (error) throw error;
        if (data) {
          setTopPerformers(data.map((p, i) => ({
            rank: i + 1,
            name: p.username || 'Anonymous',
            kp: p.total_kp.toLocaleString(),
            avatar: p.avatar_url || `7x/avataaars/svg?seed=${p.username || i}`
          })));
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard", err);
      }
    };

    const fetchTopCharacters = async () => {
      try {
        const targetSeasonId = seasonInfo?.draftSeason?.id || seasonInfo?.upcomingSeason?.id || seasonInfo?.activeSeason?.id;

        if (targetSeasonId) {
          // Get anime for this season
          const { data: animeData } = await supabase
            .from('anime_cache')
            .select('id, title_english, title_romaji')
            .eq('season_uuid', targetSeasonId);
          
          if (animeData && animeData.length > 0) {
            const animeIds = animeData.map(a => a.id);
            const animeMap = Object.fromEntries(animeData.map(a => [a.id, a.title_english || a.title_romaji]));

            const { data: charData, error: charError } = await supabase
              .from('character_cache')
              .select('*')
              .in('anime_id', animeIds)
              .order('favorites', { ascending: false })
              .limit(3);
            
            if (!charError && charData && charData.length > 0) {
              setTopCharacters(charData.map(c => ({
                ...c,
                anime_title: animeMap[c.anime_id] || "Seasonal Series"
              })));
              return;
            }
          }
        }

        // Fallback to global top characters if season filter fails
        const { data, error } = await supabase
          .from('character_cache')
          .select('*')
          .order('favorites', { ascending: false })
          .limit(3);

        if (!error && data) {
          setTopCharacters(data.map(c => ({ ...c, anime_title: "Featured Series" })));
        }
      } catch (err) {
        console.error("Failed to fetch top characters:", err);
      }
    };

    fetchLeaderboard();
    if (seasonInfo) {
      fetchTopCharacters();
    }
  }, [seasonInfo]);

  return (
    <AppShell>
      {/* Welcome Modal */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center p-6"
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 max-w-md w-full shadow-2xl overflow-hidden"
            >
              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

              {/* Close button */}
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[var(--surface-hover)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-all cursor-pointer"
              >
                <X size={14} />
              </button>

              {/* Logo mark */}
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-accent/25">
                <span className="text-white font-black text-2xl">K</span>
              </div>

              <div className="space-y-2 mb-6 relative z-10">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-accent">Welcome to</p>
                <h2 className="text-3xl font-black uppercase tracking-tighter italic font-outfit text-[var(--foreground)] leading-none">
                  Kura Anime<br />League
                </h2>
                <p className="text-[var(--muted)] font-medium text-[11px] leading-relaxed pt-1">
                  The fantasy sports experience built for the anime generation. Draft shows, earn points, and dominate your league.
                </p>
              </div>

              {/* Feature pills */}
              <div className="space-y-2 mb-6 relative z-10">
                {[
                  { icon: Swords, label: 'Draft seasonal anime like a fantasy pro' },
                  { icon: Trophy, label: 'Compete in private leagues with friends' },
                  { icon: Shield, label: 'Earn KuraPoints — your league currency' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                      <f.icon size={14} className="text-accent" />
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-80 leading-tight">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 relative z-10">
                <button
                  onClick={() => { router.push('/login'); setShowWelcomeModal(false); }}
                  className="w-full py-3 bg-accent text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:opacity-90 transition-all shadow-xl shadow-accent/20"
                >
                  Join the League — It&apos;s Free
                </button>
                <button
                  onClick={() => setShowWelcomeModal(false)}
                  className="w-full py-3 border border-[var(--border)] text-[var(--muted)] font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-hover)] transition-all"
                >
                  Browse as Guest
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-8 md:space-y-12">
        {/* Season Phase Banner */}
        <SeasonPhaseBanner showTimelineEntries={showTimelineEntries} />

        {heroContent.visible && (
          <div className="rounded-2xl md:rounded-[3rem] border border-[var(--border)] bg-gradient-to-br from-accent/10 via-black/20 to-black/60 p-6 md:p-8 text-center shadow-2xl space-y-3">
            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[var(--muted)]">Hero Broadcast</p>
            <h2 className="text-xl md:text-3xl font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-white">
              {heroContent.headline ?? DEFAULT_HERO_CONTENT.headline}
            </h2>
            <p className="text-[var(--muted)] text-xs md:text-sm leading-relaxed">
              {heroContent.subtitle ?? DEFAULT_HERO_CONTENT.subtitle}
            </p>
            {heroContent.cta && (
              <NeonButton onClick={() => router.push(heroContent.ctaLink ?? "/draft")} className="px-6 py-3 text-[10px]">
                {heroContent.cta}
              </NeonButton>
            )}
          </div>
        )}

        {announcement.visible && (
          <div
            className={`rounded-xl md:rounded-2xl border p-4 text-center space-y-2 ${announcementToneClass}`}
          >
            <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em]">
              {announcement.message || "Stay tuned for new drops"}
            </p>
            {announcement.ctaLabel && (
              <NeonButton
                variant="outline"
                onClick={() => router.push(announcement.ctaLink ?? "/")}
                className="mx-auto px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px]"
              >
                {announcement.ctaLabel}
              </NeonButton>
            )}
          </div>
        )}

        {dbError && (
          <div className="rounded-xl md:rounded-[2rem] border border-red-500/40 bg-red-500/5 px-4 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-red-500">
            Database connection issue: {dbError}
          </div>
        )}

        {/* Carousel / Hero Section */}
        {loading ? (
          <div className="h-[300px] md:h-[500px] w-full bg-[var(--surface)] rounded-2xl md:rounded-3xl flex items-center justify-center border border-[var(--border)]">
            <Loader2 className="animate-spin text-accent" size={40} />
          </div>
        ) : carouselAnime.length > 0 ? (
          <div className="relative h-[450px] md:h-[550px] w-full rounded-2xl md:rounded-[3rem] overflow-hidden group shadow-2xl border border-[var(--border)] bg-black">
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselAnime[activeIndex].id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0"
              >
                <img
                  src={carouselAnime[activeIndex].external_banner_url || carouselAnime[activeIndex].banner_image || carouselAnime[activeIndex].cover_image}
                  className="w-full h-full object-cover brightness-[0.4] transition-transform duration-[10s] scale-100 group-hover:scale-105"
                  alt={`Promotional banner for ${carouselAnime[activeIndex].title_english || carouselAnime[activeIndex].title_romaji}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-6 md:p-20 flex flex-col justify-end">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="max-w-3xl h-auto md:h-[260px] flex flex-col justify-end gap-3 md:gap-4 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                      <span className="bg-accent text-white px-3 md:px-4 py-1 md:py-1.5 text-[8px] md:text-[10px] font-black uppercase rounded-full shadow-lg shadow-accent/20">Featured</span>
                      <span className="text-white/60 text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em]">Exclusive Choice</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tighter text-white uppercase italic font-outfit leading-tight line-clamp-2 overflow-hidden text-ellipsis shrink-0" title={carouselAnime[activeIndex].title_english || carouselAnime[activeIndex].title_romaji}>
                      {carouselAnime[activeIndex].title_english || carouselAnime[activeIndex].title_romaji}
                    </h1>
                    <p className="text-gray-300 text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-60 leading-none truncate shrink-0">
                      {carouselAnime[activeIndex].title_english ? carouselAnime[activeIndex].title_romaji : 'Seasonal Spotlight'}
                    </p>
                    <p className="hidden xs:block text-gray-300 text-[10px] md:text-sm font-medium max-w-xl line-clamp-2 opacity-80 leading-relaxed uppercase tracking-[0.1em] md:tracking-widest font-sans shrink-0">
                      {carouselAnime[activeIndex].description?.replace(/<[^>]*>/g, '') || "Experience the anticipated journey first on KAL."}
                    </p>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 shrink-0 pt-2">
                      <NeonButton onClick={() => router.push('/draft')} className="py-3 px-6 text-[9px] md:text-[10px]">Draft Series</NeonButton>
                      <NeonButton variant="outline" accentColor="#ffffff" onClick={() => setActiveIndex((activeIndex + 1) % carouselAnime.length)} className="py-3 px-6 text-[9px] md:text-[10px]">Next Preview</NeonButton>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>


            {/* Carousel Navigation */}
            <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 flex gap-2 md:gap-4 z-20">
              <button
                onClick={prevSlide}
                className="p-3 md:p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 transition-all cursor-pointer text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextSlide}
                className="p-3 md:p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full hover:bg-white/10 transition-all cursor-pointer text-white"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Slider Indicators */}
            <div className="absolute bottom-1 w-full flex justify-center gap-1.5 md:gap-2 pb-6 md:pb-10 z-20">
              {carouselAnime.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-1 md:h-1.5 rounded-full transition-all duration-500 cursor-pointer ${i === activeIndex ? 'w-8 md:w-12 bg-accent' : 'w-2 md:w-3 bg-white/20'}`}
                />
              ))}
            </div>
          </div>
        ) : null}

        {showTrending && (
          <>
            {/* Trending Highlights */}
            <div className="space-y-6 md:space-y-8 pt-4 md:pt-8 px-1 md:px-2">
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[var(--border)] pb-4 md:pb-6 gap-4">
                <div className="space-y-1 md:space-y-2">
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-accent">Hot Right Now</p>
                  <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter flex items-center gap-3 md:gap-4 font-outfit leading-none text-[var(--foreground)]">
                    Trending Lineup
                  </h2>
                </div>
                <button
                  onClick={() => router.push('/draft')}
                  className="text-[9px] md:text-xs font-black text-[var(--muted)] hover:text-[var(--foreground)] transition-colors uppercase tracking-widest border border-[var(--border)] px-4 md:px-6 py-2.5 md:py-3 rounded-full hover:border-accent/40 bg-[var(--surface)] shadow-md cursor-pointer w-full md:w-auto"
                >
                  View database
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-accent" size={32} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-10">
                  {trendingShows.map((show, index) => (
                    <motion.div
                      key={show.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => router.push('/draft')}
                      className="group relative rounded-2xl md:rounded-3xl overflow-hidden border border-[var(--border)] hover:border-accent/40 transition-all cursor-pointer bg-[var(--surface)] shadow-lg md:shadow-xl"
                    >
                      <div className="aspect-[16/9] md:aspect-[16/10] overflow-hidden">
                        <img
                          src={show.external_banner_url || show.banner_image || show.cover_image}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 brightness-[0.8] group-hover:brightness-100"
                          alt={`Trending anime: ${show.title_english || show.title_romaji}`}
                        />
                      </div>
                      <div className="p-5 md:p-8 space-y-3 md:space-y-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-0.5 md:space-y-1 min-w-0 flex-1">
                            <h3 className="text-base md:text-xl font-black text-[var(--foreground)] uppercase tracking-tight truncate leading-tight" title={show.title_english || show.title_romaji}>
                              {show.title_english || show.title_romaji}
                            </h3>
                            <p className="text-[var(--muted)] text-[8px] md:text-[10px] font-bold uppercase tracking-widest truncate">
                              {show.title_english ? show.title_romaji : 'Original Series'}
                            </p>
                          </div>
                          <div className="bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-full text-[8px] md:text-[9px] font-black shrink-0">{show.cost_kp} KP</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {(showPlaybook || showMarketPulse) && (
          <>
            {/* Show Trends & Game Guide */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
              {showPlaybook && (
                <div className="lg:col-span-2 space-y-8 md:space-y-10">
                  <div className="bg-[var(--surface)] p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-[var(--border)] shadow-xl md:shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 md:p-12 opacity-[0.03] md:opacity-5 -scale-x-100 pointer-events-none">
                      <Swords size={120} />
                    </div>
                    <div className="relative z-10 space-y-6 md:space-y-8">
                      <div className="space-y-1 md:space-y-2">
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-accent">Guide</p>
                        <h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">How It Works</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-2 md:space-y-4">
                          <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-[var(--foreground)]">01. Build your lineup</p>
                          <p className="text-[var(--muted)] text-[11px] md:text-xs leading-relaxed font-medium">
                            Draft five shows within the 20,000 KP budget. Balance hype and value.
                            <span className="text-accent italic"> Drafts lock Friday at 12:00 UTC.</span>
                          </p>
                        </div>
                        <div className="space-y-2 md:space-y-4">
                          <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-[var(--foreground)]">02. Follow the trends</p>
                          <p className="text-[var(--muted)] text-[11px] md:text-xs leading-relaxed font-medium">
                            KP arrives from AniList scores, momentum swings, and community chatter. Leaderboards refresh every Monday.
                          </p>
                        </div>
                        <div className="space-y-2 md:space-y-4">
                          <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-[var(--foreground)]">03. Watch price changes</p>
                          <p className="text-[var(--muted)] text-[11px] md:text-xs leading-relaxed font-medium">
                            KP prices update daily. A sleeper snagged for 1,500 KP could spike to 4,000 KP, boosting your team value.
                          </p>
                        </div>
                        <div className="space-y-2 md:space-y-4">
                          <p className="text-[9px] md:text-[11px] font-black uppercase tracking-widest text-[var(--foreground)]">04. Make predictions</p>
                          <p className="text-[var(--muted)] text-[11px] md:text-xs leading-relaxed font-medium">
                            Use extra KP in Predictions to make calls on the week and earn bonus points.
                          </p>
                        </div>
                      </div>
                      <NeonButton onClick={() => router.push('/draft')} className="w-full md:w-fit py-3.5 md:py-4 px-10 text-[10px]">
                        Start drafting
                      </NeonButton>
                    </div>
                  </div>
                </div>
              )}
              {showMarketPulse && (
                <div className="space-y-6 md:space-y-8">
                  <div className="flex justify-between items-center px-1 md:px-2">
                    <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter font-outfit text-[var(--foreground)]">Show Trends</h3>
                    <div className="px-2 py-1 bg-green-500/10 rounded-lg text-green-500 text-[7px] md:text-[8px] font-black animate-pulse">
                      LIVE FEED
                    </div>
                  </div>
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2.5rem] divide-y divide-[var(--border)] overflow-hidden shadow-lg md:shadow-xl">
                    {marketPulseAnime.slice(0, 5).map((anime, i) => {
                      const rangeMs = 1000 * 60 * 60 * 24; // 24 hours
                      const currentPrice = anime.cost_kp;
                      const change = getHistoryChange(anime.hype_history, rangeMs, currentPrice);
                      const isPositive = change.percent >= 0;
                      return (
                      <div key={i} className="p-4 md:p-5 flex items-center gap-3 md:gap-4 hover:bg-[var(--surface-hover)] transition-all group">
                        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                          <img
                            src={anime.cover_image}
                            alt={`${anime.title_romaji} thumbnail`}
                            className="w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl object-cover border border-[var(--border)] group-hover:border-accent/50 transition-all shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[9px] md:text-[10px] font-black text-[var(--foreground)] uppercase truncate" title={anime.title_english || anime.title_romaji}>
                              {anime.title_english || anime.title_romaji}
                            </p>
                            <p className="text-[7px] md:text-[8px] font-black text-accent uppercase tracking-widest truncate opacity-70">
                              {anime.title_english ? anime.title_romaji : 'Active Market'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] md:text-[11px] font-black text-[var(--foreground)] italic leading-none mb-1">{anime.cost_kp} KP</p>
                          <p className={`text-[7px] md:text-[8px] font-black flex items-center justify-end gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                            {isPositive ? '+' : ''}{change.percent}%
                          </p>
                        </div>
                      </div>
                    );
                    })}
                    <button
                      onClick={() => router.push('/hype')}
                      className="w-full p-4 md:p-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-[var(--muted)] hover:text-accent transition-colors bg-[var(--surface-hover)]/30"
                    >
                      View Hype Rankings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {showLeaderboard && topPerformers.length > 0 && (
          <>
            {/* Leaderboard Preview & Season Highlights */}
            <div className="space-y-6 md:space-y-8 pt-6 md:pt-10 px-1 md:px-2">
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[var(--border)] pb-4 md:pb-6 gap-4">
                <div className="space-y-1 md:space-y-2">
                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-accent">Top Performers</p>
                  <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter font-outfit leading-none text-[var(--foreground)]">Elite Managers</h2>
                </div>
                <button onClick={() => router.push('/rankings')} className="text-[9px] md:text-[10px] font-black text-accent uppercase tracking-[0.15em] md:tracking-[0.2em] hover:underline cursor-pointer text-left md:text-right">View Global Rankings</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                {topPerformers.map((usr, i) => (
                  <div key={i} className="bg-[var(--surface-hover)] px-4 py-4 md:py-5 rounded-2xl md:rounded-[2rem] border border-[var(--border)] flex items-center gap-3 group hover:border-accent/30 transition-all cursor-default min-w-0 shadow-sm">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-accent/20 flex items-center justify-center text-accent font-black text-[9px] md:text-[10px] shrink-0 border border-accent/10">{usr.rank}</div>
                    <img
                      src={usr.avatar.startsWith('http') ? usr.avatar : `https://api.dicebear.com/${usr.avatar}`}
                      alt={`${usr.name} avatar`}
                      className="w-8 h-8 md:w-9 md:h-9 rounded-full border border-accent/20 shrink-0"
                    />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-[10px] md:text-[11px] font-black text-[var(--foreground)] uppercase truncate" title={usr.name}>{usr.name}</p>
                      <p className="text-[7px] md:text-[8px] font-bold text-[var(--muted)] uppercase tracking-widest truncate">{usr.kp} Total KP</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Top Characters / Recruits section */}
        <div className="space-y-6 md:space-y-8 pt-6 md:pt-10 pb-16 md:pb-20 px-1 md:px-2">
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[var(--border)] pb-4 md:pb-6 gap-4">
            <div className="space-y-1 md:space-y-2">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-accent">Star Power</p>
              <h2 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter font-outfit leading-none text-[var(--foreground)]">Top Recruits</h2>
            </div>
            <button onClick={() => router.push('/draft')} className="text-[9px] md:text-[10px] font-black text-accent uppercase tracking-[0.15em] md:tracking-[0.2em] hover:underline cursor-pointer text-left md:text-right">Draft now</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {topCharacters.map((char) => (
              <div 
                key={char.id} 
                onClick={() => setSelectedCharacter(char)}
                className="bg-[var(--surface)] border border-[var(--border)] p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] space-y-4 md:space-y-6 group hover:border-accent/30 transition-all shadow-lg flex flex-col items-center text-center cursor-pointer min-w-0"
              >
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl md:rounded-3xl overflow-hidden shrink-0 border-4 border-[var(--border)] group-hover:border-accent/30 transition-all shadow-xl md:shadow-2xl">
                  <img
                    src={char.image}
                    alt={char.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                </div>
                <div className="space-y-2 md:space-y-3 w-full">
                  <div className="space-y-1">
                    <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-accent">{char.role}</p>
                    <h3 className="text-lg md:text-xl font-black uppercase italic leading-none font-outfit text-[var(--foreground)] truncate w-full px-1" title={char.name}>{char.name}</h3>
                  </div>
                  <p className="text-[var(--muted)] font-medium leading-relaxed uppercase tracking-wider text-[9px] md:text-[10px] line-clamp-2 px-1">
                    Featured in <span className="text-accent">{char.anime_title}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <Modal 
        isOpen={!!selectedCharacter} 
        onClose={() => setSelectedCharacter(null)} 
        title={selectedCharacter?.name || ""}
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col md:flex-row gap-10 items-start p-2">
          <div className="w-full md:w-56 aspect-[3/4.5] rounded-3xl overflow-hidden border-4 border-black shadow-2xl shrink-0 bg-[var(--surface-hover)]">
            {selectedCharacter?.image && (
              <img
                src={selectedCharacter.image}
                className="w-full h-full object-cover"
                alt={selectedCharacter?.name ?? "Character"}
              />
            )}
          </div>
          <div className="grow space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedCharacter?.role}</span>
              <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedCharacter?.favorites.toLocaleString()} Faves</span>
              <span className="bg-white/5 text-[var(--muted)] border border-white/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selectedCharacter?.gender || 'Unknown'}</span>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Anime Series</p>
              <p className="text-sm font-black text-white uppercase italic tracking-tight">{selectedCharacter?.anime_title}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Character Details</p>
              <div className="text-[11px] leading-relaxed text-[var(--muted)] font-medium max-h-48 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-accent/20">
                {selectedCharacter?.about 
                  ? selectedCharacter.about
                      .replace(/<[^>]*>/g, '') // Remove HTML
                      .replace(/__(.+?)__/g, '$1') // Bold __text__
                      .replace(/~~(.+?)~~/g, '$1') // Strikethrough ~~text~~
                      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold **text**
                      .replace(/\*(.+?)\*/g, '$1') // Italic *text*
                      .replace(/_(.+?)_/g, '$1') // Italic _text_
                      .replace(/\|\|(.+?)\|\|/g, '[SPOILER]') // Spoilers
                      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
                      .replace(/\[.*?\]\(.*?\)/g, '$1') // Remove markdown links but keep text
                      .replace(/(?:Height|Age|Weight|Blood Type|Birth|Gender):.*?\n/gi, '') // Remove metadata lines
                      .replace(/\n\s*\n/g, '\n') // Multiple newlines
                      .trim()
                      .slice(0, 1000) + (selectedCharacter.about.length > 1000 ? "..." : "")
                  : "Character details are still loading."
                }
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <p className="text-[8px] font-black uppercase text-[var(--muted)] mb-1">Market Value</p>
                <p className="text-xl font-black text-white italic tracking-tighter">{selectedCharacter?.price.toLocaleString()} KP</p>
              </div>
              <div className="flex items-end justify-end">
                <NeonButton onClick={() => setSelectedCharacter(null)} className="w-full py-3 text-[10px]">Close Details</NeonButton>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}


