import { profile, impactMetrics } from "@/lib/profile";
import type { Line } from "./types";

/**
 * ASCII boot banner for `whoami` / `neofetch`. Every value comes from profile.ts
 * (zero fabrication). The figlet rows are `kind: "art"` so they render visually but
 * are aria-hidden — a screen reader would otherwise announce them as a stream of
 * meaningless punctuation (WCAG 1.1.1). The real identity lines (name/role, headline,
 * metrics, location) stay `kind: "out"` and remain fully readable to assistive tech.
 */
export function bootBanner(): Line[] {
  const metrics = impactMetrics.map((m) => `${m.value} ${m.label} (${m.sub})`).join("  ·  ");
  const art: Line[] = [
    "   _              _ _            ",
    "  /_\\  _ ___ _ __(_) |_ _ _ _  _ ",
    " / _ \\| ' \\ V / | | |  _| '_| || |",
    "/_/ \\_\\_||_\\_/  |_|_|\\__|_|  \\_, |",
    "                            |__/ ",
  ].map((text) => ({ kind: "art", text }));

  return [
    ...art,
    { kind: "out", text: "" },
    { kind: "out", text: `${profile.name} — ${profile.role} @ ${profile.company}` },
    { kind: "out", text: profile.headline },
    { kind: "out", text: "" },
    { kind: "out", text: metrics },
    { kind: "out", text: `${profile.locationCity}, ${profile.locationCountry}  ·  github.com/${profile.githubUser}` },
    { kind: "out", text: "" },
    { kind: "out", text: "Type 'help' to explore — or tap a chip below." },
  ];
}
