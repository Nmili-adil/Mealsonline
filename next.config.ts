import type { NextConfig } from "next";

const imageHosts = (process.env.IMAGE_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Cache Components (Next 16) is intentionally disabled for this project:
  // admin pages read the session cookie and public pages read the database per
  // request (live catalog/order state), which fits classic dynamic rendering
  // better than prerendered shells.
  images: imageHosts.length
    ? {
        remotePatterns: imageHosts.map((host) => ({
          protocol: "https" as const,
          hostname: host,
        })),
      }
    : undefined,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
