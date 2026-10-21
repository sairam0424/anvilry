import type { StaticImageData } from "next/image";
import gearbotDirections from "@/assets/mascots/gearbot-directions.webp";
import gearbotReactions from "@/assets/mascots/gearbot-reactions.webp";
import crtDirections from "@/assets/mascots/crt-directions.webp";
import crtReactions from "@/assets/mascots/crt-reactions.webp";
import tvDirections from "@/assets/mascots/tv-directions.webp";
import tvReactions from "@/assets/mascots/tv-reactions.webp";
import radioDirections from "@/assets/mascots/radio-directions.webp";
import radioReactions from "@/assets/mascots/radio-reactions.webp";

/**
 * The drawn characters Anvilry ships, as sprite-sheet pairs from page-mascot
 * (https://koboyo.com/page-mascot, MIT © 2026 Kamran Ahmed — THIRD_PARTY_NOTICES.md).
 * Each sheet is a 1080×1080 WebP with alpha, a 3×3 grid of 360 px cells; the two files are
 * the whole character, so swapping one in (a chibi drawn from a photo, say) is a two-file
 * change here. Static imports give content-hashed `/_next/static/media/` URLs with immutable
 * caching; under Vitest the same import resolves to a plain path string. A page only
 * downloads the pair it renders.
 *
 *   gearbot — the site's own head: hero (NEXT_PUBLIC_HERO_MODE=mascot) and the About portrait
 *             (NEXT_PUBLIC_ABOUT_MASCOT=true); both opt-in.
 *   crt, tv, radio — three retro receivers with a face for the 404 kernel-panic page ("no
 *             signal / static / dead air"); one is picked per view, never the same twice in a
 *             row (pickNotFoundMascot). Default ON.
 */
type Sheet = StaticImageData | string;

type Character = {
  directions: Sheet;
  reactions: Sheet;
  /** Screen-reader name: the mascot button reads "Boop the {label}". */
  label: string;
};

export const MASCOT_CHARACTERS = {
  gearbot: { directions: gearbotDirections as Sheet, reactions: gearbotReactions as Sheet, label: "mascot" },
  crt: { directions: crtDirections as Sheet, reactions: crtReactions as Sheet, label: "CRT monitor" },
  tv: { directions: tvDirections as Sheet, reactions: tvReactions as Sheet, label: "television" },
  radio: { directions: radioDirections as Sheet, reactions: radioReactions as Sheet, label: "radio" },
} as const satisfies Record<string, Character>;

export type MascotCharacter = keyof typeof MASCOT_CHARACTERS;

const url = (sheet: Sheet): string => (typeof sheet === "string" ? sheet : sheet.src);

/** Served URLs of a character's two sheets. */
export function mascotSheets(name: MascotCharacter): { directions: string; reactions: string } {
  const character = MASCOT_CHARACTERS[name];
  return { directions: url(character.directions), reactions: url(character.reactions) };
}

/** The 404 rotation, in sheet-registry order. */
export const NOT_FOUND_MASCOTS = ["crt", "tv", "radio"] as const satisfies readonly MascotCharacter[];
export type NotFoundMascotCharacter = (typeof NOT_FOUND_MASCOTS)[number];

export function isNotFoundMascot(value: unknown): value is NotFoundMascotCharacter {
  return typeof value === "string" && (NOT_FOUND_MASCOTS as readonly string[]).includes(value);
}

/**
 * Random pick from the 404 trio that is never `last` (what the previous 404 in this session
 * showed; anything that is not one of the three widens the pool to all of them). `random`
 * is injectable for tests and must return a number in [0, 1).
 */
export function pickNotFoundMascot(
  last: string | null,
  random: () => number = Math.random,
): NotFoundMascotCharacter {
  const pool = isNotFoundMascot(last) ? NOT_FOUND_MASCOTS.filter((c) => c !== last) : [...NOT_FOUND_MASCOTS];
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}

/** About-page portrait. OFF by default, like the hero head; `NEXT_PUBLIC_ABOUT_MASCOT=true` shows it (build-time). */
export function isAboutMascotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ABOUT_MASCOT === "true";
}

/** 404-page mascot. On by default; `NEXT_PUBLIC_404_MASCOT=false` hides it (build-time). */
export function isNotFoundMascotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_404_MASCOT !== "false";
}
