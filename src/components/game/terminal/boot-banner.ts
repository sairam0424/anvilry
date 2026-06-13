import { profile, impactMetrics } from "@/lib/profile";

/** ASCII boot banner for `whoami` / `neofetch`. Every value comes from profile.ts. */
export function bootBanner(): string[] {
  const metrics = impactMetrics.map((m) => `${m.value} ${m.label} (${m.sub})`).join("  ·  ");
  return [
    "   _              _ _            ",
    "  /_\\  _ ___ _ __(_) |_ _ _ _  _ ",
    " / _ \\| ' \\ V / | | |  _| '_| || |",
    "/_/ \\_\\_||_\\_/  |_|_|\\__|_|  \\_, |",
    "                            |__/ ",
    "",
    `${profile.name} — ${profile.role} @ ${profile.company}`,
    profile.headline,
    "",
    metrics,
    `${profile.locationCity}, ${profile.locationCountry}  ·  github.com/${profile.githubUser}`,
    "",
    "Type 'help' to explore — or tap a chip below.",
  ];
}
