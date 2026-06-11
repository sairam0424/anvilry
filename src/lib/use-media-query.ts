import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query without setState-in-effect.
 * Server snapshot = false (mobile-first / no-WebGL default), client reads the real match.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
