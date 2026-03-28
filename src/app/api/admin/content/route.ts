import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminContent, upsertAdminContent, logAdminAction } from "@/lib/admin-data";
import { supabaseAdmin } from "@/lib/supabase/admin";

const HERO_KEY = "hero_banner";
const CONFIG_KEY = "admin_display_config";
const ANNOUNCEMENT_KEY = "site_announcement";
const LEVELING_KEY = "leveling_config";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const hero = (await getAdminContent(HERO_KEY)) ?? {};
  const config = (await getAdminContent(CONFIG_KEY)) ?? {};
  const announcement = (await getAdminContent(ANNOUNCEMENT_KEY)) ?? {};
  const leveling = (await getAdminContent(LEVELING_KEY)) ?? {};
  return NextResponse.json({ hero, config, announcement, leveling });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const payload = await request.json().catch(() => ({}));
  const heroUpdates = payload.hero;
  const configUpdates = payload.config;
  const announcementUpdates = payload.announcement;
  const levelingUpdates = payload.leveling;

  const currentHero = (await getAdminContent(HERO_KEY)) ?? {};
  const currentConfig = (await getAdminContent(CONFIG_KEY)) ?? {};
  const currentAnnouncement = (await getAdminContent(ANNOUNCEMENT_KEY)) ?? {};
  const currentLeveling = (await getAdminContent(LEVELING_KEY)) ?? {};

  let heroResult = currentHero;
  let configResult = currentConfig;
  let announcementResult = currentAnnouncement;
  let levelingResult = currentLeveling;
  const updatedSections: string[] = [];

  if (heroUpdates && Object.keys(heroUpdates).length) {
    heroResult = { ...currentHero, ...heroUpdates };
    await upsertAdminContent(HERO_KEY, heroResult);
    updatedSections.push("hero");
  }

  if (configUpdates && Object.keys(configUpdates).length) {
    configResult = { ...currentConfig, ...configUpdates };
    await upsertAdminContent(CONFIG_KEY, configResult);
    updatedSections.push("config");
  }

  if (announcementUpdates && Object.keys(announcementUpdates).length) {
    announcementResult = { ...currentAnnouncement, ...announcementUpdates };
    await upsertAdminContent(ANNOUNCEMENT_KEY, announcementResult);
    updatedSections.push("announcement");
  }

  const hasLevelingChanges =
    levelingUpdates &&
    Object.keys(levelingUpdates).some((key) => levelingUpdates[key] !== currentLeveling[key as keyof typeof levelingUpdates]);

  if (levelingUpdates && Object.keys(levelingUpdates).length && hasLevelingChanges) {
    levelingResult = { ...currentLeveling, ...levelingUpdates };
    await upsertAdminContent(LEVELING_KEY, levelingResult);
    const { error: recalcError } = await supabaseAdmin.rpc("recalculate_levels");
    if (recalcError) {
      throw new Error(recalcError.message);
    }
    updatedSections.push("leveling");
  }

  if (!updatedSections.length) {
    return NextResponse.json({ error: "No content updates provided" }, { status: 400 });
  }

  await logAdminAction({
    actionType: "content_update",
    description: `Content sections (${updatedSections.join(", ")}) updated by ${admin.user.email}`,
    createdBy: admin.user.id,
    details: {
      hero: heroResult,
      config: configResult,
      announcement: announcementResult,
      leveling: levelingResult
    }
  });

  return NextResponse.json({ hero: heroResult, config: configResult, announcement: announcementResult, leveling: levelingResult });
}
