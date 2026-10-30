import { getSiteSettings } from "@/lib/site";

export async function AnnouncementBar() {
  const settings = await getSiteSettings();
  if (!settings.announcement.enabled) return null;
  return <div className="announcement-bar">{settings.announcement.message}</div>;
}
