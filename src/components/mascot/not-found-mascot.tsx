"use client";

import { useEffect, useMemo } from "react";
import { useMounted } from "@/lib/use-mounted";
import { MASCOT_CHARACTERS, pickNotFoundMascot, type NotFoundMascotCharacter } from "@/lib/mascots";
import { SiteMascot } from "./site-mascot";

/** sessionStorage key holding the character the previous 404 in this tab showed. */
export const NOT_FOUND_MASCOT_STORAGE_KEY = "anvilry:404:mascot";

function readLast(): string | null {
  try {
    return sessionStorage.getItem(NOT_FOUND_MASCOT_STORAGE_KEY);
  } catch {
    return null; // storage disabled: fall back to a plain random pick
  }
}

function writeLast(character: NotFoundMascotCharacter): void {
  try {
    sessionStorage.setItem(NOT_FOUND_MASCOT_STORAGE_KEY, character);
  } catch {
    // private mode / quota: the next 404 may repeat; nothing else is affected
  }
}

/**
 * One of the thirteen 404 characters (NOT_FOUND_MASCOTS in src/lib/mascots.ts), picked PER VIEW
 * IN THE BROWSER and never the same one twice in a row within a tab.
 *
 * Why client-side: `/_not-found` is prerendered as a static file (one HTML for every missing
 * URL), so the server cannot roll a die per request without turning the 404 into a serverless
 * render for every scanner hit, and a pick made during a shared render would differ between
 * server and client (hydration mismatch). `useMounted` (useSyncExternalStore, no
 * setState-in-effect) keeps the server/first-paint path static: a reserved box of `size`
 * height, so the terminal below never shifts when the head arrives right after hydration.
 * `useMemo` on `mounted` picks once per component instance — a fresh 404 view is a fresh pick;
 * the effect records it for the next one.
 */
export function NotFoundMascot({ size = 120 }: { size?: number }) {
  const mounted = useMounted();
  const character = useMemo<NotFoundMascotCharacter | null>(
    () => (mounted ? pickNotFoundMascot(readLast()) : null),
    [mounted],
  );

  useEffect(() => {
    if (character) writeLast(character);
  }, [character]);

  return (
    <div className="mb-6 flex justify-center" style={{ minHeight: size }}>
      {character && (
        <SiteMascot character={character} size={size} label={MASCOT_CHARACTERS[character].label} />
      )}
    </div>
  );
}
