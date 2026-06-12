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

let webglSupport: boolean | null = null;

/**
 * Whether the browser can actually create a WebGL context. R3F surfaces a failed
 * context as an async unhandledRejection that React error boundaries CANNOT catch,
 * so we probe proactively (once, memoized) and skip mounting the Canvas entirely
 * when unsupported — GPU-blocklisted, headless software-GL refused, or WebGL off.
 * The probe canvas is created + discarded; the result is cached for the session.
 */
export function useWebGLSupported(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      if (webglSupport !== null) return webglSupport;
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl");
        webglSupport = gl != null;
      } catch {
        webglSupport = false;
      }
      return webglSupport;
    },
    () => false, // server: never attempt WebGL during SSR
  );
}
