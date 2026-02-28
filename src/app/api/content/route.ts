import { NextResponse } from "next/server";
import { getAdminContent } from "@/lib/admin-data";

const HERO_KEY = "hero_banner";
const CONFIG_KEY = "admin_display_config";
const ANNOUNCEMENT_KEY = "site_announcement";

export async function GET() {
  try {
    const hero = (await getAdminContent(HERO_KEY)) ?? {};
    const config = (await getAdminContent(CONFIG_KEY)) ?? {};
    const announcement = (await getAdminContent(ANNOUNCEMENT_KEY)) ?? {};
    return NextResponse.json({ hero, config, announcement });
  } catch (error) {
    console.error("Failed to load site content", error);
    return NextResponse.json({ hero: {}, config: {}, announcement: {} }, { status: 500 });
  }
}
