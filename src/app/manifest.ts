import type { MetadataRoute } from "next";
import { profile } from "@/lib/profile";

// Web app manifest — name, theme color, and icon for "Add to Home Screen" / PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.name} — ${profile.role}`,
    short_name: profile.name,
    description: profile.headline,
    start_url: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon", sizes: "any", type: "image/png", purpose: "maskable" },
    ],
    // NOTE: no `screenshots` key. It previously declared /static/screenshot-desktop.png and
    // /static/screenshot-mobile.png, but public/static/ is empty — both URLs 404, so the
    // entries were dead weight and the rich install card had nothing to show. Screenshots are
    // optional in the manifest spec; omitting them is correct until the assets actually exist.
    // To re-add: drop the PNGs in public/static/ and restore a `screenshots` array here —
    // manifest.test.ts asserts every declared src resolves, so it will hold you to it.
  };
}
