import type { StaticImageData } from "next/image";
import gearbotDirections from "@/assets/mascots/gearbot-directions.webp";
import gearbotReactions from "@/assets/mascots/gearbot-reactions.webp";
import crtDirections from "@/assets/mascots/crt-directions.webp";
import crtReactions from "@/assets/mascots/crt-reactions.webp";
import tvDirections from "@/assets/mascots/tv-directions.webp";
import tvReactions from "@/assets/mascots/tv-reactions.webp";
import radioDirections from "@/assets/mascots/radio-directions.webp";
import radioReactions from "@/assets/mascots/radio-reactions.webp";
import toasterDirections from "@/assets/mascots/toaster-directions.webp";
import toasterReactions from "@/assets/mascots/toaster-reactions.webp";
import clockworkDirections from "@/assets/mascots/clockwork-directions.webp";
import clockworkReactions from "@/assets/mascots/clockwork-reactions.webp";
import cubeDirections from "@/assets/mascots/cube-directions.webp";
import cubeReactions from "@/assets/mascots/cube-reactions.webp";
import droneDirections from "@/assets/mascots/drone-directions.webp";
import droneReactions from "@/assets/mascots/drone-reactions.webp";
import knightDirections from "@/assets/mascots/knight-directions.webp";
import knightReactions from "@/assets/mascots/knight-reactions.webp";
import lanternDirections from "@/assets/mascots/lantern-directions.webp";
import lanternReactions from "@/assets/mascots/lantern-reactions.webp";
import postbotDirections from "@/assets/mascots/postbot-directions.webp";
import postbotReactions from "@/assets/mascots/postbot-reactions.webp";
import rocketDirections from "@/assets/mascots/rocket-directions.webp";
import rocketReactions from "@/assets/mascots/rocket-reactions.webp";
import scoutDirections from "@/assets/mascots/scout-directions.webp";
import scoutReactions from "@/assets/mascots/scout-reactions.webp";
import penguinDirections from "@/assets/mascots/penguin-directions.webp";
import penguinReactions from "@/assets/mascots/penguin-reactions.webp";

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
 *   crt, tv, radio, toaster, clockwork, cube, drone, knight, lantern, postbot, rocket, scout,
 *   penguin — the 404 rotation: every "thing with a face" the project draws (minus gearbot,
 *             which is the site's own head) plus the penguin, a nod to the kernel-panic
 *             terminal; one is picked per view, never the same twice in a row
 *             (pickNotFoundMascot). Default ON. People characters are deliberately absent: on a
 *             personal site they read as someone else.
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
  toaster: { directions: toasterDirections as Sheet, reactions: toasterReactions as Sheet, label: "toaster" },
  clockwork: { directions: clockworkDirections as Sheet, reactions: clockworkReactions as Sheet, label: "clockwork robot" },
  cube: { directions: cubeDirections as Sheet, reactions: cubeReactions as Sheet, label: "cube robot" },
  drone: { directions: droneDirections as Sheet, reactions: droneReactions as Sheet, label: "drone" },
  knight: { directions: knightDirections as Sheet, reactions: knightReactions as Sheet, label: "knight" },
  lantern: { directions: lanternDirections as Sheet, reactions: lanternReactions as Sheet, label: "lantern robot" },
  postbot: { directions: postbotDirections as Sheet, reactions: postbotReactions as Sheet, label: "mail robot" },
  rocket: { directions: rocketDirections as Sheet, reactions: rocketReactions as Sheet, label: "rocket" },
  scout: { directions: scoutDirections as Sheet, reactions: scoutReactions as Sheet, label: "scout robot" },
  penguin: { directions: penguinDirections as Sheet, reactions: penguinReactions as Sheet, label: "penguin" },
} as const satisfies Record<string, Character>;

export type MascotCharacter = keyof typeof MASCOT_CHARACTERS;

const url = (sheet: Sheet): string => (typeof sheet === "string" ? sheet : sheet.src);

/** Served URLs of a character's two sheets. */
export function mascotSheets(name: MascotCharacter): { directions: string; reactions: string } {
  const character = MASCOT_CHARACTERS[name];
  return { directions: url(character.directions), reactions: url(character.reactions) };
}

/** The 404 rotation: the three receivers first, then the other things, then the penguin. */
export const NOT_FOUND_MASCOTS = [
  "crt", "tv", "radio", "toaster", "clockwork", "cube", "drone",
  "knight", "lantern", "postbot", "rocket", "scout", "penguin",
] as const satisfies readonly MascotCharacter[];
export type NotFoundMascotCharacter = (typeof NOT_FOUND_MASCOTS)[number];

export function isNotFoundMascot(value: unknown): value is NotFoundMascotCharacter {
  return typeof value === "string" && (NOT_FOUND_MASCOTS as readonly string[]).includes(value);
}

/**
 * Random pick from the 404 rotation that is never `last` (what the previous 404 in this session
 * showed; anything that is not in the rotation widens the pool to all of them). `random`
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

// The NEXT_PUBLIC_* flags live in src/lib/mascot-flags.ts, which has no image imports, so client
// code (the root not-found boundary) can read them without pulling this registry into the
// shared layout chunk.
