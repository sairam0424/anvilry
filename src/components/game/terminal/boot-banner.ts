import { profile, impactMetrics } from "@/lib/profile";
import { hasPersonalContent } from "@/lib/personal";
import type { Line } from "./types";

/**
 * Boot sequence for the 404 page. Simulates a kernel panic — 3 fake module-load
 * lines, then a KERNEL PANIC halt. The shell survives, which is the point: a recruiter
 * landing on a 404 still gets the real terminal with all its commands intact.
 */
export function bootBanner404(): Line[] {
  return [
    { kind: "art", text: "  [    0.000000] anvilry kernel 6.9.0-anvilry-ai+" },
    { kind: "art", text: "  [    0.042000] loading genai-router.................. OK" },
    { kind: "art", text: "  [    0.087000] loading agent-mesh................... OK" },
    { kind: "art", text: "  [    0.113000] loading route-resolver..............." },
    { kind: "out", text: "" },
    { kind: "err", text: "KERNEL PANIC: route not found (0x404)" },
    { kind: "err", text: "shell survived — try: ls, help, cd /" },
    { kind: "out", text: "" },
  ];
}

/**
 * ASCII boot banner for `whoami` / `neofetch`.
 *
 * Pattern: plain spaced text with hierarchy — no box-drawing.
 * Research confirms top terminal portfolios (satnaing, Kielx, npx pattern) use
 * clean paragraph-style identity output for boot, reserving boxes for command
 * responses. Metrics shortened to fit ~80 chars without line wrapping.
 *
 * Kind "art" = aria-hidden (screen readers skip decorative figlet lines — WCAG 1.1.1).
 * Kind "out" = readable identity content, announced by the live region.
 */
export function bootBanner(): Line[] {
  // Compact metrics: "2K+ users · 3K+ users · 8 OSS repos" — fits ~60 chars without wrapping.
  // Full sub-labels (Pensieve, AAVA Code) available via 'ls work' and 'stats' commands.
  const metricsShort = impactMetrics
    .map((m) => `${m.value} ${m.label.replace("daily users", "users").replace("open-source repos", "OSS repos")}`)
    .join("  ·  ");

  const art: Line[] = [
    "   _              _ _            ",
    "  /_\\  _ ___ _ __(_) |_ _ _ _  _ ",
    " / _ \\| ' \\ V / | | |  _| '_| || |",
    "/_/ \\_\\_||_\\_/  |_|_|\\__|_|  \\_, |",
    "                            |__/ ",
  ].map((text) => ({ kind: "art" as const, text }));

  const lines: Line[] = [
    ...art,
    { kind: "out", text: "" },
    { kind: "out", text: `  ${profile.name} — ${profile.role} @ ${profile.company}` },
    { kind: "out", text: `  ${profile.headline}` },
    { kind: "out", text: "" },
    { kind: "out", text: `  ${metricsShort}` },
    { kind: "out", text: `  ${profile.locationCity}, ${profile.locationCountry}  ·  github.com/${profile.githubUser}` },
    { kind: "out", text: "" },
    { kind: "out", text: "  → type 'help' to explore  ·  tap a chip below" },
  ];

  if (hasPersonalContent) {
    lines.push({ kind: "out", text: "  ◇ tip: there's more than the résumé here — try 'secret'." });
  }
  return lines;
}
