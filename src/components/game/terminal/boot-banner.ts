import { profile, impactMetrics } from "@/lib/profile";
import { hasPersonalContent } from "@/lib/personal";
import * as fmt from "./fmt";
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
 * Uses the original thin figlet-style ASCII art (safe browser rendering — no
 * double-width Unicode box chars that cause layout explosions in monospace fonts).
 * The identity card below uses fmt.box() for visual structure.
 *
 * Kind "art" = aria-hidden so screen readers skip decorative lines (WCAG 1.1.1).
 * The real identity content uses kind "out" and stays fully readable.
 */
export function bootBanner(): Line[] {
  const metrics = impactMetrics.map((m) => `${m.value} ${m.label} (${m.sub})`).join("  ·  ");

  // Original thin-line figlet art — renders correctly in all browser monospace fonts.
  // Double-width Unicode block chars (██╗) break layout in browser environments.
  const art: Line[] = [
    "   _              _ _            ",
    "  /_\\  _ ___ _ __(_) |_ _ _ _  _ ",
    " / _ \\| ' \\ V / | | |  _| '_| || |",
    "/_/ \\_\\_||_\\_/  |_|_|\\__|_|  \\_, |",
    "                            |__/ ",
  ].map((text) => ({ kind: "art" as const, text }));

  // Identity card — boxed for visual structure. Metrics stay OUTSIDE the box
  // so they render at full width (the box clips at W=56; metrics string is longer).
  const identityBox = fmt.box("// IDENTITY", [
    fmt.row("●", "name",     `${profile.name}`),
    fmt.row("●", "role",     `${profile.role} @ ${profile.company}`),
    fmt.row("●", "location", `${profile.locationCity}, ${profile.locationCountry}`),
    fmt.row("●", "github",   `github.com/${profile.githubUser}`),
  ]);

  const lines: Line[] = [
    ...art,
    fmt.blank(),
    ...identityBox,
    fmt.blank(),
    // Metrics full-width (not truncated inside a box)
    { kind: "out", text: `  ${metrics}` },
    fmt.blank(),
    { kind: "out", text: "  → type 'help' to explore  ·  tap a chip below" },
  ];

  if (hasPersonalContent) {
    lines.push({ kind: "out", text: "  ◇ tip: there's more than the résumé here — try 'secret'." });
  }
  return lines;
}
