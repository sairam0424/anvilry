import { describe, expect, it } from "vitest";
import {
  ALL_VOICES,
  CURATED_VOICES,
  EXTENDED_VOICES,
  findBrowserVoice,
  getDefaultVoiceId,
  getVoiceById,
  getVoiceByGoogleName,
  getVoiceByPollyId,
  getVoicesForEngine,
  resolveGoogleVoiceName,
  resolvePollyParams,
  validateVoiceForEngine,
  type VoiceEntry,
} from "./voice-catalog";

/**
 * Pure-data + tiny-lookup module — these tests pin the catalog's invariants so a
 * future edit (typo, duplicate id, missing engine field) can't silently ship to
 * production. Two classes of guarantees: structural (every entry well-formed,
 * unique ids) and behavioral (lookups + the validateVoiceForEngine allowlist gate
 * the API routes will call).
 */

describe("catalog structure", () => {
  it("has 6 curated voices", () => {
    expect(CURATED_VOICES).toHaveLength(6);
  });

  it("curated voices cover both genders", () => {
    const genders = new Set(CURATED_VOICES.map((v) => v.gender));
    expect(genders.has("female")).toBe(true);
    expect(genders.has("male")).toBe(true);
  });

  it("curated voices cover both Polly tiers + Google", () => {
    const polly = CURATED_VOICES.filter((v) => v.engine === "polly");
    const google = CURATED_VOICES.filter((v) => v.engine === "google");
    expect(polly.some((v) => v.pollyTier === "neural")).toBe(true);
    expect(polly.some((v) => v.pollyTier === "generative")).toBe(true);
    expect(google.length).toBeGreaterThan(0);
  });

  it("every voice has a unique id", () => {
    const ids = ALL_VOICES.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Polly entries have pollyVoiceId + pollyTier; Google entries have googleVoiceName; browser entries have browserVoiceURIPrefix", () => {
    for (const v of ALL_VOICES) {
      if (v.engine === "polly") {
        expect(v.pollyVoiceId, `polly voice ${v.id} missing pollyVoiceId`).toBeTruthy();
        expect(v.pollyTier, `polly voice ${v.id} missing pollyTier`).toBeTruthy();
      } else if (v.engine === "google") {
        expect(v.googleVoiceName, `google voice ${v.id} missing googleVoiceName`).toBeTruthy();
      } else if (v.engine === "browser") {
        expect(
          v.browserVoiceURIPrefix,
          `browser voice ${v.id} missing browserVoiceURIPrefix`,
        ).toBeTruthy();
      }
    }
  });

  it("every voice has a non-empty sampleText for tap-to-preview", () => {
    for (const v of ALL_VOICES) {
      expect(v.sampleText.length).toBeGreaterThan(10);
      expect(v.sampleText.length).toBeLessThan(200); // catalog comment: <1.5s budget
    }
  });

  it("ALL_VOICES is the union of curated + extended (no duplicates, no holes)", () => {
    expect(ALL_VOICES.length).toBe(CURATED_VOICES.length + EXTENDED_VOICES.length);
  });
});

describe("getDefaultVoiceId()", () => {
  it("returns Joanna by default (preserves v1.6 behavior)", () => {
    expect(getDefaultVoiceId()).toBe("polly-neural-joanna");
  });

  it("returns Matthew when male is preferred", () => {
    expect(getDefaultVoiceId("male")).toBe("polly-neural-matthew");
  });

  it("returns Joanna when female is explicitly preferred", () => {
    expect(getDefaultVoiceId("female")).toBe("polly-neural-joanna");
  });

  it("the returned id is always resolvable", () => {
    expect(getVoiceById(getDefaultVoiceId())).toBeDefined();
    expect(getVoiceById(getDefaultVoiceId("male"))).toBeDefined();
    expect(getVoiceById(getDefaultVoiceId("female"))).toBeDefined();
  });
});

describe("getVoiceById()", () => {
  it("resolves a known id", () => {
    expect(getVoiceById("polly-neural-joanna")?.displayName).toBe("Joanna");
  });

  it("returns undefined for an unknown id (caller falls back to default)", () => {
    expect(getVoiceById("does-not-exist")).toBeUndefined();
  });

  it("returns undefined for empty/null/undefined input (NOT throw)", () => {
    expect(getVoiceById(undefined)).toBeUndefined();
    expect(getVoiceById(null)).toBeUndefined();
    expect(getVoiceById("")).toBeUndefined();
  });
});

describe("getVoiceByPollyId() / getVoiceByGoogleName()", () => {
  it("maps AWS VoiceId back to the catalog entry", () => {
    expect(getVoiceByPollyId("Joanna")?.id).toBe("polly-neural-joanna");
    expect(getVoiceByPollyId("Stephen")?.id).toBe("polly-generative-stephen");
  });

  it("maps Google voice name back to the catalog entry", () => {
    expect(getVoiceByGoogleName("en-US-Chirp3-HD-Aoede")?.id).toBe("google-chirp3-aoede");
  });

  it("unknown native id → undefined", () => {
    expect(getVoiceByPollyId("Nonexistent")).toBeUndefined();
    expect(getVoiceByGoogleName("en-US-Junk")).toBeUndefined();
  });
});

describe("getVoicesForEngine()", () => {
  it("returns only voices for the named engine", () => {
    const polly = getVoicesForEngine("polly");
    expect(polly.length).toBeGreaterThan(0);
    for (const v of polly) expect(v.engine).toBe("polly");

    const google = getVoicesForEngine("google");
    for (const v of google) expect(v.engine).toBe("google");

    const browser = getVoicesForEngine("browser");
    for (const v of browser) expect(v.engine).toBe("browser");
  });

  it("partitions ALL_VOICES exactly (no leaks, no overlaps)", () => {
    const total =
      getVoicesForEngine("polly").length +
      getVoicesForEngine("google").length +
      getVoicesForEngine("browser").length;
    expect(total).toBe(ALL_VOICES.length);
  });
});

describe("validateVoiceForEngine() — server allowlist gate", () => {
  it("accepts a known voice on its own engine", () => {
    expect(validateVoiceForEngine("polly-neural-joanna", "polly")).toBe(true);
    expect(validateVoiceForEngine("google-chirp3-aoede", "google")).toBe(true);
  });

  it("rejects a voice on the wrong engine (the cross-engine attack)", () => {
    expect(validateVoiceForEngine("polly-neural-joanna", "google")).toBe(false);
    expect(validateVoiceForEngine("google-chirp3-aoede", "polly")).toBe(false);
  });

  it("rejects an unknown voiceId", () => {
    expect(validateVoiceForEngine("not-a-voice", "polly")).toBe(false);
  });

  it("when a Polly tier is asserted, mismatch rejects (Joanna+generative would 5xx at AWS)", () => {
    expect(validateVoiceForEngine("polly-neural-joanna", "polly", "generative")).toBe(false);
    expect(validateVoiceForEngine("polly-generative-stephen", "polly", "neural")).toBe(false);
  });

  it("matching tier accepts", () => {
    expect(validateVoiceForEngine("polly-neural-joanna", "polly", "neural")).toBe(true);
    expect(validateVoiceForEngine("polly-generative-stephen", "polly", "generative")).toBe(true);
  });

  it("absent tier accepts (catalog's tier is the source of truth)", () => {
    expect(validateVoiceForEngine("polly-neural-joanna", "polly")).toBe(true);
    expect(validateVoiceForEngine("polly-generative-stephen", "polly")).toBe(true);
  });
});

describe("resolvePollyParams() / resolveGoogleVoiceName()", () => {
  it("returns the engine-native params for a Polly id", () => {
    const r = resolvePollyParams("polly-generative-stephen");
    expect(r).toEqual({ pollyVoiceId: "Stephen", tier: "generative" });
  });

  it("returns undefined for non-Polly id", () => {
    expect(resolvePollyParams("google-chirp3-aoede")).toBeUndefined();
    expect(resolvePollyParams("not-a-voice")).toBeUndefined();
  });

  it("returns the Google voice name for a Google id", () => {
    expect(resolveGoogleVoiceName("google-chirp3-aoede")).toBe("en-US-Chirp3-HD-Aoede");
  });

  it("Google resolver returns undefined for non-Google id", () => {
    expect(resolveGoogleVoiceName("polly-neural-joanna")).toBeUndefined();
    expect(resolveGoogleVoiceName("not-a-voice")).toBeUndefined();
  });
});

describe("findBrowserVoice() — voiceURI prefix match (pitfall #14)", () => {
  const fakeVoices = [
    { voiceURI: "Microsoft Aria Online (Natural) - English (United States)" },
    { voiceURI: "com.apple.voice.premium.en-US.Samantha" },
    { voiceURI: "com.apple.eloquence.en-US.Bahh" },
    { voiceURI: "Google US English+f3" }, // Linux speech-dispatcher modifier
  ];

  it("matches Microsoft Online voices by URI prefix (Edge)", () => {
    const found = findBrowserVoice("browser-edge-aria", fakeVoices);
    expect(found?.voiceURI).toContain("Microsoft Aria Online");
  });

  it("matches Apple Premium voices by URI prefix (Safari)", () => {
    const found = findBrowserVoice("browser-apple-samantha-premium", fakeVoices);
    expect(found?.voiceURI).toContain("Samantha");
  });

  it("returns undefined when the curated voice is not on this device (Apple Premium not downloaded, etc.)", () => {
    const found = findBrowserVoice("browser-edge-guy", fakeVoices);
    expect(found).toBeUndefined();
  });

  it("returns undefined for non-browser ids (Polly + Google)", () => {
    expect(findBrowserVoice("polly-neural-joanna", fakeVoices)).toBeUndefined();
    expect(findBrowserVoice("google-chirp3-aoede", fakeVoices)).toBeUndefined();
  });

  it("does not match by name — would fail under macOS localization (pitfall #14)", () => {
    // A localized "Samantha" might display as another string in a non-en UI locale,
    // but the voiceURI is stable. This test pins the prefix-match contract.
    const localizedFakeVoices = [
      { voiceURI: "com.apple.voice.premium.en-US.Samantha" }, // URI is stable
    ];
    const found = findBrowserVoice("browser-apple-samantha-premium", localizedFakeVoices);
    expect(found).toBeDefined();
  });
});

describe("immutability (the catalog is build-time static)", () => {
  it("CURATED_VOICES, EXTENDED_VOICES, ALL_VOICES are frozen-in-spirit (TS-readonly)", () => {
    // We can't easily test runtime Object.freeze without `as const` deep-freeze,
    // but we can verify the type contract by attempting an assignment that should
    // be a TS error. At runtime this test just asserts the arrays exist and the
    // types are ReadonlyArray<VoiceEntry>.
    const _typeCheck: ReadonlyArray<VoiceEntry> = CURATED_VOICES;
    expect(_typeCheck.length).toBe(6);
  });
});
