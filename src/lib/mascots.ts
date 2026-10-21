import type { StaticImageData } from "next/image";
import gearbotDirections from "@/assets/mascots/gearbot-directions.webp";
import gearbotReactions from "@/assets/mascots/gearbot-reactions.webp";
import crtDirections from "@/assets/mascots/crt-directions.webp";
import crtReactions from "@/assets/mascots/crt-reactions.webp";

/**
 * The drawn characters Anvilry ships, as sprite-sheet pairs from page-mascot
 * (https://koboyo.com/page-mascot, MIT © 2026 Kamran Ahmed — THIRD_PARTY_NOTICES.md).
 * Each sheet is a 1080×1080 WebP with alpha, a 3×3 grid of 360 px cells; the two files are
 * the whole character, so swapping one in (a chibi drawn from a photo, say) is a two-file
 * change here. Static imports give content-hashed `/_next/static/media/` URLs with immutable
 * caching; under Vitest the same import resolves to a plain path string.
 *
 *   gearbot — the site's own head: hero (NEXT_PUBLIC_HERO_MODE=mascot) and the About portrait
 *             (NEXT_PUBLIC_ABOUT_MASCOT=true); both opt-in.
 *   crt     — a CRT monitor with a face, for the 404 kernel-panic page.
 */
type Sheet = StaticImageData | string;

export const MASCOT_CHARACTERS = {
  gearbot: { directions: gearbotDirections as Sheet, reactions: gearbotReactions as Sheet },
  crt: { directions: crtDirections as Sheet, reactions: crtReactions as Sheet },
} as const;

export type MascotCharacter = keyof typeof MASCOT_CHARACTERS;

const url = (sheet: Sheet): string => (typeof sheet === "string" ? sheet : sheet.src);

/** Served URLs of a character's two sheets. */
export function mascotSheets(name: MascotCharacter): { directions: string; reactions: string } {
  const character = MASCOT_CHARACTERS[name];
  return { directions: url(character.directions), reactions: url(character.reactions) };
}

/** About-page portrait. OFF by default, like the hero head; `NEXT_PUBLIC_ABOUT_MASCOT=true` shows it (build-time). */
export function isAboutMascotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ABOUT_MASCOT === "true";
}

/** 404-page mascot. On by default; `NEXT_PUBLIC_404_MASCOT=false` hides it (build-time). */
export function isNotFoundMascotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_404_MASCOT !== "false";
}
