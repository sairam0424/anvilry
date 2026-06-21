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
 * Block-character ASCII art header (uses full-block ▓ and half-block characters
 * for visual weight, inspired by MindForge's terminal design). Kind "art" means
 * aria-hidden — screen readers skip the decorative art and only announce the real
 * identity lines below (WCAG 1.1.1 compliance).
 */
export function bootBanner(): Line[] {
  const metrics = impactMetrics.map((m) => `${m.value} ${m.label} (${m.sub})`).join("  ·  ");

  // Block-character ASCII art — heavier visual weight than thin figlet lines.
  // Uses ▓ (dark shade block) + space for contrast. Each line is "art" (aria-hidden).
  const art: Line[] = [
    " █████╗ ███╗  ██╗██╗   ██╗██╗██╗     ██████╗ ██╗   ██╗",
    "██╔══██╗████╗ ██║██║   ██║██║██║     ██╔══██╗╚██╗ ██╔╝",
    "███████║██╔██╗██║╚██╗ ██╔╝██║██║     ██████╔╝ ╚████╔╝ ",
    "██╔══██║██║╚████║ ╚████╔╝ ██║██║     ██╔══██╗  ╚██╔╝  ",
    "██║  ██║██║ ╚███║  ╚██╔╝  ██║███████╗██║  ██║   ██║   ",
    "╚═╝  ╚═╝╚═╝  ╚══╝   ╚═╝   ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ",
  ].map((text) => ({ kind: "art" as const, text }));

  const lines: Line[] = [
    ...art,
    { kind: "out", text: "" },
    { kind: "out", text: `${profile.name} — ${profile.role} @ ${profile.company}` },
    { kind: "out", text: profile.headline },
    { kind: "out", text: "" },
    { kind: "out", text: metrics },
    { kind: "out", text: `${profile.locationCity}, ${profile.locationCountry}  ·  github.com/${profile.githubUser}` },
    { kind: "out", text: "" },
    { kind: "out", text: "  → type 'help' to explore  ·  tap a chip below" },
  ];

  if (hasPersonalContent) {
    lines.push({ kind: "out", text: "  ◇ tip: there's more than the résumé here — try 'secret'." });
  }
  return lines;
}
