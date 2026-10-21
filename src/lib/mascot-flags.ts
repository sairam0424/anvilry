/**
 * Build-time flags for the mascot surfaces. Kept apart from src/lib/mascots.ts on purpose:
 * that module statically imports all fourteen sprite sheets, and the root not-found boundary
 * is a CLIENT component bundled into the shared layout chunk — importing the registry there
 * for a flag read dragged every image descriptor onto every page (~16 KB of first-load JS on /).
 * This file has no image imports, so client code can read the flags for free.
 */

/** About-page portrait. OFF by default, like the hero head; `NEXT_PUBLIC_ABOUT_MASCOT=true` shows it. */
export function isAboutMascotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ABOUT_MASCOT === "true";
}

/** 404-page mascot rotation. On by default; `NEXT_PUBLIC_404_MASCOT=false` hides it. */
export function isNotFoundMascotEnabled(): boolean {
  return process.env.NEXT_PUBLIC_404_MASCOT !== "false";
}
