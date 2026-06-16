/**
 * Voice catalog — single source of truth for every voice the picker exposes, across
 * the three engines (browser, Polly, Google Cloud TTS).
 *
 * Curated set (6 voices) is what the default picker shows: 2 free-tier Polly Neural
 * voices (Joanna + Matthew, the historical defaults), 2 Polly Generative voices
 * (Stephen + Ruth — premium picks reachable only when the user opts in), and 2
 * Google Chirp 3 HD voices (Aoede + Charon — permanent-free hedge against Polly's
 * 12-month free-tier cliff). Extended set (the "More voices" overflow) widens the
 * cast to GB/AU accents and to a handful of curated browser voices keyed by
 * voiceURI prefix (Microsoft Online Natural on Edge, Apple Premium on Safari).
 *
 * Each entry is engine-specific — a Polly voice ID does NOT cross over to Google,
 * so each entry stamps its own engine + tier. The default-picker UI groups by
 * engine; the Cmd+K palette flattens all curated voices to one searchable list.
 *
 * Pure data + tiny lookup helpers, no React / no I/O — the picker UI imports this
 * directly, the /api/tts allowlist validator imports this, the useSpeechSynthesis
 * hook imports this. Mutations forbidden by `as const` + ReadonlyArray; updating
 * the catalog requires editing this file and rebuilding (catalog is build-time
 * static, like every other Anvilry feature flag).
 */

export type VoiceEngine = "browser" | "polly" | "google";
export type PollyTier = "neural" | "generative";
export type VoiceGender = "female" | "male";
export type VoiceAccent = "us" | "gb" | "au" | "in";

/**
 * One voice entry. `id` is the stable picker key (e.g. "polly-neural-joanna"); the
 * engine-native identifier lives on the engine-specific field (`pollyVoiceId`,
 * `googleVoiceName`, `browserVoiceURIPrefix`) so the picker can resolve it without
 * peeking at strings. The two-word `descriptor` is what the default picker UI
 * shows under the name ("warm & direct", "clear & conversational"), keeping the
 * card list scannable at a glance.
 */
export type VoiceEntry = Readonly<{
  id: string;
  displayName: string;
  /** Two-word personality summary the picker UI shows under the name. */
  descriptor: string;
  gender: VoiceGender;
  accent: VoiceAccent;
  engine: VoiceEngine;
  /** Polly engine tier. Required when engine=polly, absent otherwise. */
  pollyTier?: PollyTier;
  /** Native engine identifier — what the engine API expects. */
  pollyVoiceId?: string;
  googleVoiceName?: string;
  /** voiceURI prefix-match for the browser engine. macOS localizes display names
   *  and Linux speech-dispatcher appends +m1/+f1 modifiers, so the URI is the only
   *  stable handle (pitfall #14: never trust voice.name for matching). */
  browserVoiceURIPrefix?: string;
  /** Sample text the picker speaks on tap-to-preview. Kept short enough to fit in
   *  Polly's first-sentence latency budget (<1.5s on cold start). */
  sampleText: string;
}>;

/* ---------------------------- Curated (default 6) ---------------------------- */

const JOANNA: VoiceEntry = {
  id: "polly-neural-joanna",
  displayName: "Joanna",
  descriptor: "clear & conversational",
  gender: "female",
  accent: "us",
  engine: "polly",
  pollyTier: "neural",
  pollyVoiceId: "Joanna",
  sampleText: "Hi, I'm Joanna. I'll read your answer in a clear, conversational voice.",
} as const;

const MATTHEW: VoiceEntry = {
  id: "polly-neural-matthew",
  displayName: "Matthew",
  descriptor: "steady & professional",
  gender: "male",
  accent: "us",
  engine: "polly",
  pollyTier: "neural",
  pollyVoiceId: "Matthew",
  sampleText: "Hi, I'm Matthew. I'll read your answer in a steady, professional voice.",
} as const;

const STEPHEN: VoiceEntry = {
  id: "polly-generative-stephen",
  displayName: "Stephen",
  descriptor: "warm & direct",
  gender: "male",
  accent: "us",
  engine: "polly",
  pollyTier: "generative",
  pollyVoiceId: "Stephen",
  sampleText: "Hi, I'm Stephen. I'll read your answer in a warm, direct voice.",
} as const;

const RUTH: VoiceEntry = {
  id: "polly-generative-ruth",
  displayName: "Ruth",
  descriptor: "natural & expressive",
  gender: "female",
  accent: "us",
  engine: "polly",
  pollyTier: "generative",
  pollyVoiceId: "Ruth",
  sampleText: "Hi, I'm Ruth. I'll read your answer in a natural, expressive voice.",
} as const;

const AOEDE: VoiceEntry = {
  id: "google-chirp3-aoede",
  displayName: "Aoede",
  descriptor: "bright & friendly",
  gender: "female",
  accent: "us",
  engine: "google",
  googleVoiceName: "en-US-Chirp3-HD-Aoede",
  sampleText: "Hi, I'm Aoede. I'll read your answer in a bright, friendly voice.",
} as const;

const CHARON: VoiceEntry = {
  id: "google-chirp3-charon",
  displayName: "Charon",
  descriptor: "grounded & calm",
  gender: "male",
  accent: "us",
  engine: "google",
  googleVoiceName: "en-US-Chirp3-HD-Charon",
  sampleText: "Hi, I'm Charon. I'll read your answer in a grounded, calm voice.",
} as const;

/** The curated 6 — what the default picker UI shows. The first two are also the
 *  default-pick fallback chain (Joanna for the historical default, Matthew as the
 *  male equivalent in gender mode). */
export const CURATED_VOICES: ReadonlyArray<VoiceEntry> = [
  JOANNA,
  MATTHEW,
  STEPHEN,
  RUTH,
  AOEDE,
  CHARON,
] as const;

/* ----------------------------- Extended overflow ----------------------------- */

const EXTENDED_POLLY: ReadonlyArray<VoiceEntry> = [
  {
    id: "polly-neural-danielle",
    displayName: "Danielle",
    descriptor: "polished & poised",
    gender: "female",
    accent: "us",
    engine: "polly",
    pollyTier: "neural",
    pollyVoiceId: "Danielle",
    sampleText: "Hi, I'm Danielle. I'll read your answer in a polished, poised voice.",
  },
  {
    id: "polly-neural-gregory",
    displayName: "Gregory",
    descriptor: "deep & measured",
    gender: "male",
    accent: "us",
    engine: "polly",
    pollyTier: "neural",
    pollyVoiceId: "Gregory",
    sampleText: "Hi, I'm Gregory. I'll read your answer in a deep, measured voice.",
  },
  {
    id: "polly-neural-brian",
    displayName: "Brian",
    descriptor: "British & crisp",
    gender: "male",
    accent: "gb",
    engine: "polly",
    pollyTier: "neural",
    pollyVoiceId: "Brian",
    sampleText: "Hi, I'm Brian. I'll read your answer with a British, crisp accent.",
  },
  {
    id: "polly-neural-amy",
    displayName: "Amy",
    descriptor: "British & inviting",
    gender: "female",
    accent: "gb",
    engine: "polly",
    pollyTier: "neural",
    pollyVoiceId: "Amy",
    sampleText: "Hi, I'm Amy. I'll read your answer with a British, inviting accent.",
  },
  {
    id: "polly-neural-olivia",
    displayName: "Olivia",
    descriptor: "Australian & open",
    gender: "female",
    accent: "au",
    engine: "polly",
    pollyTier: "neural",
    pollyVoiceId: "Olivia",
    sampleText: "Hi, I'm Olivia. I'll read your answer with an Australian, open accent.",
  },
] as const;

const EXTENDED_GOOGLE: ReadonlyArray<VoiceEntry> = [
  {
    id: "google-chirp3-puck",
    displayName: "Puck",
    descriptor: "lively & light",
    gender: "male",
    accent: "us",
    engine: "google",
    googleVoiceName: "en-US-Chirp3-HD-Puck",
    sampleText: "Hi, I'm Puck. I'll read your answer in a lively, light voice.",
  },
  {
    id: "google-chirp3-kore",
    displayName: "Kore",
    descriptor: "soft & focused",
    gender: "female",
    accent: "us",
    engine: "google",
    googleVoiceName: "en-US-Chirp3-HD-Kore",
    sampleText: "Hi, I'm Kore. I'll read your answer in a soft, focused voice.",
  },
  {
    id: "google-chirp3-fenrir",
    displayName: "Fenrir",
    descriptor: "bold & rich",
    gender: "male",
    accent: "us",
    engine: "google",
    googleVoiceName: "en-US-Chirp3-HD-Fenrir",
    sampleText: "Hi, I'm Fenrir. I'll read your answer in a bold, rich voice.",
  },
] as const;

/** Browser-native voices — keyed by voiceURI prefix because display names are
 *  localized (macOS) or modifier-mangled (Linux). On a browser without a matching
 *  voice the picker silently falls back to the engine default. */
const EXTENDED_BROWSER: ReadonlyArray<VoiceEntry> = [
  {
    id: "browser-edge-aria",
    displayName: "Aria (Edge)",
    descriptor: "Microsoft & natural",
    gender: "female",
    accent: "us",
    engine: "browser",
    browserVoiceURIPrefix: "Microsoft Aria Online",
    sampleText: "Hi, I'm Aria. I'm a Microsoft online neural voice for Edge.",
  },
  {
    id: "browser-edge-guy",
    displayName: "Guy (Edge)",
    descriptor: "Microsoft & friendly",
    gender: "male",
    accent: "us",
    engine: "browser",
    browserVoiceURIPrefix: "Microsoft Guy Online",
    sampleText: "Hi, I'm Guy. I'm a Microsoft online neural voice for Edge.",
  },
  {
    id: "browser-apple-samantha-premium",
    displayName: "Samantha (Apple)",
    descriptor: "Apple Premium & familiar",
    gender: "female",
    accent: "us",
    engine: "browser",
    browserVoiceURIPrefix: "com.apple.voice.premium.en-US.Samantha",
    sampleText: "Hi, I'm Samantha. I'm an Apple Premium voice — download me in System Settings.",
  },
  {
    id: "browser-apple-tom-premium",
    displayName: "Tom (Apple)",
    descriptor: "Apple Premium & relaxed",
    gender: "male",
    accent: "us",
    engine: "browser",
    browserVoiceURIPrefix: "com.apple.voice.premium.en-US.Tom",
    sampleText: "Hi, I'm Tom. I'm an Apple Premium voice — download me in System Settings.",
  },
] as const;

/** All extended voices grouped for the overflow dialog. */
export const EXTENDED_VOICES: ReadonlyArray<VoiceEntry> = [
  ...EXTENDED_POLLY,
  ...EXTENDED_GOOGLE,
  ...EXTENDED_BROWSER,
] as const;

/** Every voice the catalog knows about (curated + extended). Used by the validator
 *  in /api/tts and /api/tts-google to allowlist voiceId from a request body. */
export const ALL_VOICES: ReadonlyArray<VoiceEntry> = [
  ...CURATED_VOICES,
  ...EXTENDED_VOICES,
] as const;

/* --------------------------------- Lookups ---------------------------------- */

const BY_ID: ReadonlyMap<string, VoiceEntry> = new Map(ALL_VOICES.map((v) => [v.id, v]));

const BY_POLLY_VOICE_ID: ReadonlyMap<string, VoiceEntry> = new Map(
  ALL_VOICES.filter((v) => v.engine === "polly" && v.pollyVoiceId).map((v) => [
    v.pollyVoiceId as string,
    v,
  ]),
);

const BY_GOOGLE_NAME: ReadonlyMap<string, VoiceEntry> = new Map(
  ALL_VOICES.filter((v) => v.engine === "google" && v.googleVoiceName).map((v) => [
    v.googleVoiceName as string,
    v,
  ]),
);

/** The voice the system picks when no `voiceId` is set in settings. Joanna stays
 *  the default for the female / unspecified case to preserve v1.6 behavior; Matthew
 *  is the default-male answer when the picker is in gender mode. */
export function getDefaultVoiceId(genderPref?: VoiceGender): string {
  if (genderPref === "male") return MATTHEW.id;
  return JOANNA.id;
}

/** Look up a catalog entry by id. Returns undefined for unknown ids — callers MUST
 *  fall back to getDefaultVoiceId() rather than 500. */
export function getVoiceById(id: string | undefined | null): VoiceEntry | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

/** Look up a Polly voice by its native AWS VoiceId (e.g. "Joanna"). Used by the
 *  /api/tts route to map a request's voiceId-as-AWS-name back to the catalog
 *  for tier validation. */
export function getVoiceByPollyId(pollyVoiceId: string): VoiceEntry | undefined {
  return BY_POLLY_VOICE_ID.get(pollyVoiceId);
}

/** Look up a Google voice by its full name (e.g. "en-US-Chirp3-HD-Aoede"). */
export function getVoiceByGoogleName(googleVoiceName: string): VoiceEntry | undefined {
  return BY_GOOGLE_NAME.get(googleVoiceName);
}

/** All voices for an engine (used by the picker UI's engine-grouped overflow). */
export function getVoicesForEngine(engine: VoiceEngine): ReadonlyArray<VoiceEntry> {
  return ALL_VOICES.filter((v) => v.engine === engine);
}

/** Server-side allowlist gate: is this voiceId valid for this engine, with this
 *  optional Polly tier? Returns false on unknown voice, mismatched engine, or
 *  unsupported tier. The /api/tts and /api/tts-google routes call this before
 *  forwarding to the engine API. */
export function validateVoiceForEngine(
  voiceId: string,
  engine: VoiceEngine,
  pollyTier?: PollyTier,
): boolean {
  const v = BY_ID.get(voiceId);
  if (!v) return false;
  if (v.engine !== engine) return false;
  if (engine === "polly") {
    if (!v.pollyTier) return false;
    // If the request asserts a tier, it must match the catalog entry's tier — the
    // catalog is the source of truth on which voices support which Polly engine
    // (Generative is gated to a specific subset; sending Joanna with tier=generative
    // would 5xx at AWS).
    if (pollyTier && v.pollyTier !== pollyTier) return false;
  }
  return true;
}

/** Resolve the pollyVoiceId + tier the engine actually expects, given a catalog
 *  id. Returns undefined for non-Polly entries — callers should branch on engine. */
export function resolvePollyParams(
  voiceId: string,
): { pollyVoiceId: string; tier: PollyTier } | undefined {
  const v = BY_ID.get(voiceId);
  if (!v || v.engine !== "polly" || !v.pollyVoiceId || !v.pollyTier) return undefined;
  return { pollyVoiceId: v.pollyVoiceId, tier: v.pollyTier };
}

/** Resolve the Google voice name the engine expects, given a catalog id. */
export function resolveGoogleVoiceName(voiceId: string): string | undefined {
  const v = BY_ID.get(voiceId);
  if (!v || v.engine !== "google") return undefined;
  return v.googleVoiceName;
}

/** Find a browser voice from the SpeechSynthesis voice list that matches a catalog
 *  entry's voiceURI prefix. Handles the macOS localization + Linux modifier mess
 *  (pitfall #14) by anchoring on voiceURI, never voice.name. */
export function findBrowserVoice<V extends { voiceURI: string }>(
  voiceId: string,
  voices: ReadonlyArray<V>,
): V | undefined {
  const v = BY_ID.get(voiceId);
  if (!v || v.engine !== "browser" || !v.browserVoiceURIPrefix) return undefined;
  const prefix = v.browserVoiceURIPrefix;
  return voices.find((sv) => sv.voiceURI.startsWith(prefix));
}
