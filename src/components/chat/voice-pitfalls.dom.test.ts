import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectScreenReader,
  FIRST_RUN_PRIMER_STORAGE_KEY,
  getVoicesRaceHardened,
  hasSeenFirstRunPrimer,
  isAndroid,
  isFirefox,
  isIOS,
  markFirstRunPrimerSeen,
} from "./voice-pitfalls";

/**
 * DOM-dependent pitfall utilities — UA detection, getVoices race-harden,
 * localStorage primer flag, screen-reader heuristic. These need a real
 * window/navigator/localStorage, so they live under happy-dom.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UA detection — pitfalls #2 / #12 / #13", () => {
  it("isIOS returns false on a desktop UA", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120",
    });
    expect(isIOS()).toBe(false);
  });

  it("isIOS returns true for iPhone UA", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    });
    expect(isIOS()).toBe(true);
  });

  it("isAndroid returns true for Android UA", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14)" });
    expect(isAndroid()).toBe(true);
  });

  it("isAndroid returns false for desktop Linux UA", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/120",
    });
    expect(isAndroid()).toBe(false);
  });

  it("isFirefox returns true for Firefox UA", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/120",
    });
    expect(isFirefox()).toBe(true);
  });
});

describe("first-run primer storage — pitfall #2 hint", () => {
  beforeEach(() => {
    window.localStorage.removeItem(FIRST_RUN_PRIMER_STORAGE_KEY);
  });

  it("hasSeenFirstRunPrimer returns false initially", () => {
    expect(hasSeenFirstRunPrimer()).toBe(false);
  });

  it("markFirstRunPrimerSeen flips the flag persistently", () => {
    markFirstRunPrimerSeen();
    expect(hasSeenFirstRunPrimer()).toBe(true);
    expect(window.localStorage.getItem(FIRST_RUN_PRIMER_STORAGE_KEY)).toBe("1");
  });

  it("markFirstRunPrimerSeen swallows localStorage errors (private mode)", () => {
    const orig = window.localStorage.setItem;
    Object.defineProperty(window.localStorage, "setItem", {
      value: () => {
        throw new Error("quota exceeded");
      },
      configurable: true,
    });
    expect(() => markFirstRunPrimerSeen()).not.toThrow();
    Object.defineProperty(window.localStorage, "setItem", {
      value: orig,
      configurable: true,
    });
  });
});

describe("getVoicesRaceHardened — pitfall #7", () => {
  it("resolves immediately when getVoices returns voices synchronously", async () => {
    const fakeVoice = { voiceURI: "Test", name: "Test", lang: "en-US" } as unknown as SpeechSynthesisVoice;
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [fakeVoice],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const voices = await getVoicesRaceHardened();
    expect(voices).toEqual([fakeVoice]);
  });

  it("resolves on voiceschanged event (the Chromium async path)", async () => {
    const listenerRef: { current: (() => void) | null } = { current: null };
    let voices: SpeechSynthesisVoice[] = [];
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => voices,
      addEventListener: (_: string, l: () => void) => {
        listenerRef.current = l;
      },
      removeEventListener: vi.fn(),
    });
    const promise = getVoicesRaceHardened();
    voices = [{ voiceURI: "Loaded" } as unknown as SpeechSynthesisVoice];
    listenerRef.current?.();
    const result = await promise;
    expect(result.length).toBe(1);
  });

  it("resolves on timeout if voiceschanged never fires (degraded environment)", async () => {
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const result = await getVoicesRaceHardened(20);
    expect(result).toEqual([]);
  });
});

describe("SR-aware default OFF (regression — pitfall #1 invariant)", () => {
  it("voice settings default ttsEnabled is false even if SR is detected", async () => {
    // Stub matchMedia to force "reduced motion" → detectScreenReader() may return true.
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: true }),
      configurable: true,
    });
    // Re-import the settings module and confirm DEFAULTS.ttsEnabled is still false.
    // The invariant is structural: detectScreenReader is a HEURISTIC that should
    // NEVER auto-flip ttsEnabled to true (the SR + read-aloud double-speak is the
    // worst-case a11y regression). The store is the source of truth and ships OFF.
    const { DEFAULTS } = await import("@/lib/voice-settings-context");
    expect(DEFAULTS.ttsEnabled).toBe(false);
  });
});

describe("detectScreenReader — pitfall #1 (heuristic, never definitive)", () => {
  it("returns false when prefers-reduced-motion is NOT set (the dominant case)", () => {
    Object.defineProperty(window, "matchMedia", {
      value: () => ({ matches: false }),
      configurable: true,
    });
    expect(detectScreenReader()).toBe(false);
  });

  it("does not throw when matchMedia is unavailable (very old browsers)", () => {
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      configurable: true,
    });
    // The function uses ?. on matchMedia and try/catch, so absence resolves to false.
    expect(() => detectScreenReader()).not.toThrow();
  });
});
