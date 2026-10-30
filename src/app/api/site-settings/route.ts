import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Public-safe site settings (no secrets, no admin data). */
export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json({
    announcement: settings.announcement,
    restaurant: settings.restaurant,
    hero: settings.hero,
  });
}
