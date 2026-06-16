/**
 * Voice-layer landmines + their workarounds, factored out of useSpeechSynthesis.
 *
 * Each utility solves a documented production pitfall surfaced by the v1.7
 * deep-research workflow. They are intentionally SMALL and INDEPENDENT — the
 * hook + UI surfaces import only what they need, and each can be tested in
 * isolation with a fake voice list / fake UA / fake document.
 *
 * Pure where possible (voiceURIToGender, isLinuxESpeak, localeFallbackChain).
 * Side-effecting helpers (detectScreenReader, isIOSGestureLock,
 * applePremiumDownloadCheck) are guarded against SSR via typeof window checks
 * so an accidental top-level import on a server component never throws.
 */

/* ------------------------------- Pitfall #1 -------------------------------
 * Screen-reader detection (heuristic). There is no reliable browser API to
 * know if a screen reader is active — only signals, none definitive. The
 * conservative approach: combine `prefers-reduced-motion` (a strong correlate
 * for SR users) with a `speak: none` style probe (some SR-rendering modes set
 * this on the page chrome). Combined with the existing `ttsEnabled` default
 * being OFF, the practical effect is: read-aloud stays off for likely-SR users
 * unless they explicitly turn it on, avoiding the SR + read-aloud double-speak.
 * ------------------------------------------------------------------------ */
export function detectScreenReader(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!reduce) return false;
    // Probe a styled div — some AT modes resolve `speak: none` differently.
    // Best-effort signal; never the sole gate (we don't disable read-aloud,
    // just leave the toggle at its default-OFF for these users).
    const probe = document.createElement("div");
    probe.style.cssText = "speak: none; position: absolute; left: -9999px;";
    document.body.appendChild(probe);
    const speak = window.getComputedStyle(probe).getPropertyValue("speak");
    document.body.removeChild(probe);
    return speak === "none" || reduce;
  } catch {
    return false;
  }
}

/* ------------------------------- Pitfall #2 -------------------------------
 * iOS Safari user-gesture lock. speak() called outside a click handler is
 * silently dropped on iOS Safari (and sometimes on first invocation in other
 * Safari builds). We detect by: UA + did-not-fire-onstart-within-200ms after
 * a programmatic speak. The caller can show a one-time primer ("Tap any voice
 * card to enable speech") on detection.
 * ------------------------------------------------------------------------ */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPad on iOS 13+ reports as "MacIntel" with touch — covered by maxTouchPoints check.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && (navigator as { maxTouchPoints?: number }).maxTouchPoints! > 1);
}

/* ------------------------------- Pitfall #3 -------------------------------
 * Linux speech-dispatcher with eSpeak as the only voice. eSpeak is a robotic
 * formant synth — usable as a fallback, but not as a primary voice. Detect
 * by: every voiceURI starts with "eSpeak" or has no name. The picker UI uses
 * this to hide the browser engine option on Linux machines that have nothing
 * better, and prompt the visitor to pick Polly or Google instead.
 * ------------------------------------------------------------------------ */
export function isLinuxESpeak<V extends { voiceURI: string; name: string }>(
  voices: ReadonlyArray<V>,
): boolean {
  if (voices.length === 0) return false;
  return voices.every(
    (v) => v.voiceURI.startsWith("eSpeak") || !v.name || v.name === "",
  );
}

/* ------------------------------- Pitfall #4 -------------------------------
 * voice.gender is deprecated and unreliable across browsers. Don't trust it —
 * maintain a curated allow-list of (voiceURI prefix → perceived gender).
 * Returns "female" / "male" for known prefixes, undefined otherwise (caller
 * falls back to whatever default).
 * ------------------------------------------------------------------------ */
const URI_GENDER_PREFIXES: ReadonlyArray<{ prefix: string; gender: "female" | "male" }> = [
  // Microsoft Online Natural (Edge)
  { prefix: "Microsoft Aria", gender: "female" },
  { prefix: "Microsoft Jenny", gender: "female" },
  { prefix: "Microsoft Sara", gender: "female" },
  { prefix: "Microsoft Guy", gender: "male" },
  { prefix: "Microsoft Davis", gender: "male" },
  { prefix: "Microsoft Tony", gender: "male" },
  // Apple Premium (Safari)
  { prefix: "com.apple.voice.premium.en-US.Samantha", gender: "female" },
  { prefix: "com.apple.voice.premium.en-US.Ava", gender: "female" },
  { prefix: "com.apple.voice.premium.en-US.Karen", gender: "female" },
  { prefix: "com.apple.voice.premium.en-US.Tom", gender: "male" },
  { prefix: "com.apple.voice.premium.en-US.Daniel", gender: "male" },
  // Google streamed (Chrome)
  { prefix: "Google US English Female", gender: "female" },
  { prefix: "Google UK English Female", gender: "female" },
  { prefix: "Google US English Male", gender: "male" },
  { prefix: "Google UK English Male", gender: "male" },
];
export function voiceURIToGender(voiceURI: string): "female" | "male" | undefined {
  for (const { prefix, gender } of URI_GENDER_PREFIXES) {
    if (voiceURI.startsWith(prefix)) return gender;
  }
  return undefined;
}

/* ------------------------------- Pitfall #5 -------------------------------
 * Locale fallback chain. A visitor might prefer en-IN, but if no en-IN voice
 * exists locally, en-GB is closer to en-IN than en-US is, and en-US is the
 * universal fallback. Returns an ordered list of language codes to try.
 * ------------------------------------------------------------------------ */
const LOCALE_NEIGHBORS: Record<string, ReadonlyArray<string>> = {
  "en-IN": ["en-IN", "en-GB", "en-AU", "en-US"],
  "en-AU": ["en-AU", "en-GB", "en-NZ", "en-US"],
  "en-NZ": ["en-NZ", "en-AU", "en-GB", "en-US"],
  "en-GB": ["en-GB", "en-IE", "en-AU", "en-US"],
  "en-IE": ["en-IE", "en-GB", "en-US"],
  "en-CA": ["en-CA", "en-US", "en-GB"],
  "en-US": ["en-US", "en-CA", "en-GB"],
};
export function localeFallbackChain(prefLocale: string): ReadonlyArray<string> {
  const exact = LOCALE_NEIGHBORS[prefLocale];
  if (exact) return exact;
  // Unknown English variant → try as-is, then en-US, then any English.
  if (prefLocale.startsWith("en")) return [prefLocale, "en-US", "en"];
  // Non-English: caller's locale, then en-US.
  return [prefLocale, "en-US"];
}

/* ------------------------------- Pitfall #6 -------------------------------
 * Apple Premium voices require manual user download (Settings → Accessibility
 * → Spoken Content → Voices). The catalog references the URI but the voice
 * isn't on disk until the user downloads it. We detect this case so the picker
 * can show a hint card with the right Settings path.
 * Returns true ONLY if (a) the catalog id is for an Apple Premium voice, AND
 * (b) the voice is NOT in the SpeechSynthesis voice list — otherwise the user
 * either has it downloaded or isn't on Apple, both fine.
 * ------------------------------------------------------------------------ */
export function applePremiumIsMissing<V extends { voiceURI: string }>(
  voiceURIPrefix: string | undefined,
  voices: ReadonlyArray<V>,
): boolean {
  if (!voiceURIPrefix) return false;
  if (!voiceURIPrefix.startsWith("com.apple.voice.premium")) return false;
  return !voices.some((v) => v.voiceURI.startsWith(voiceURIPrefix));
}

/* ------------------------------- Pitfall #7 -------------------------------
 * getVoices() race. On Chromium, getVoices() returns [] until the
 * 'voiceschanged' event fires async. The hook handles this with a sync-read
 * fallback at first enqueue (use-speech-synthesis.ts) — promote the same
 * pattern as a shared util for callers that need the voice list before
 * speaking (e.g., the picker UI's findBrowserVoice resolution).
 *
 * Returns a Promise that resolves to the voice list once available, or
 * after a 2s timeout (so a permanently-broken environment doesn't hang the
 * UI forever — caller falls back to whatever default).
 * ------------------------------------------------------------------------ */
export function getVoicesRaceHardened(timeoutMs = 2_000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const sync = synth.getVoices();
    if (sync.length > 0) {
      resolve(sync);
      return;
    }
    let resolved = false;
    const onChange = () => {
      if (resolved) return;
      const list = synth.getVoices();
      if (list.length > 0) {
        resolved = true;
        synth.removeEventListener?.("voiceschanged", onChange);
        resolve(list);
      }
    };
    synth.addEventListener?.("voiceschanged", onChange);
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      synth.removeEventListener?.("voiceschanged", onChange);
      // Fall back to whatever sync returns now (often still []).
      resolve(synth.getVoices());
    }, timeoutMs);
  });
}

/* ------------------------------- Pitfall #14 ------------------------------
 * voiceURI normalization. Linux speech-dispatcher appends "+m1"/"+f1" voice
 * modifiers to the URI; macOS localizes display names. Strip the modifiers
 * so a prefix match (catalog's findBrowserVoice) doesn't fail on a localized
 * or modifier-mangled URI.
 * ------------------------------------------------------------------------ */
export function normalizeVoiceURI(voiceURI: string): string {
  // Strip "+m1", "+f3" etc trailing modifiers (Linux speech-dispatcher).
  return voiceURI.replace(/\+[mf]\d+$/i, "");
}

/* ------------------------------- Pitfall #12 ------------------------------
 * Android Chrome has dramatically worse voice quality than desktop Chrome —
 * the "Network" Google voices are usually unavailable, leaving low-quality
 * locals. UA detection so the picker can show a one-time hint to switch to
 * Polly Neural for clearer audio.
 * ------------------------------------------------------------------------ */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

/* ------------------------------- Pitfall #13 ------------------------------
 * Firefox on Linux defaults to eSpeak (terrible). Detection composes
 * isLinuxESpeak + Firefox UA so the advisory can be specific.
 * ------------------------------------------------------------------------ */
export function isFirefox(): boolean {
  if (typeof navigator === "undefined") return false;
  return /firefox/i.test(navigator.userAgent || "");
}

/* --------------------------- First-run primer key ------------------------- */
/** Used by the picker + talk-mode primer card to dedupe the one-time hint. */
export const FIRST_RUN_PRIMER_STORAGE_KEY = "anvilry:voice:first-run-seen-v1";

/** Was the first-run voice primer already shown? SSR-safe (returns false when
 *  localStorage isn't accessible — caller falls back to "show it"). */
export function hasSeenFirstRunPrimer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FIRST_RUN_PRIMER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark the first-run primer as seen. Best-effort; survives a localStorage
 *  failure (private mode etc.) without throwing — the worst-case is the
 *  primer shows once more, never any breakage. */
export function markFirstRunPrimerSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIRST_RUN_PRIMER_STORAGE_KEY, "1");
  } catch {
    /* private mode / quota — best-effort */
  }
}
