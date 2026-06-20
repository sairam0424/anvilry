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
    screenshots: [
      {
        src: "/static/screenshot-desktop.png",
        sizes: "1280x800",
        type: "image/png",
        form_factor: "wide",
        label: "Anvilry Portfolio — Desktop",
      },
      {
        src: "/static/screenshot-mobile.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "Anvilry Portfolio — Mobile",
      },
    ],
  };
}
