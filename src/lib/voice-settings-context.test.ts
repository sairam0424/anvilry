import { describe, it, expect } from "vitest";
import { DEFAULT_VOICE_CHARACTER, DEFAULTS, parse } from "./voice-settings-context";

/**
 * The voice settings store is the opt-in ledger for the whole voice layer, so its
 * contract is safety-critical: everything must default OFF / browser, and a partial
 * or corrupt persisted payload must upgrade cleanly to a fully-valid object rather
 * than throw (a parse error here would break the chat on load). These are pure-logic
 * assertions on parse() + DEFAULTS; the React subscription is exercised in app use.
 */

describe("voice settings DEFAULTS", () => {
  it("ships every capability OFF and every engine on the free/browser path", () => {
    expect(DEFAULTS).toEqual({
      micEnabled: false,
      ttsEnabled: false,
      wakeWord: false,
      captions: true, // captions default ON (a11y) — the one non-false default
      sttEngine: "browser",
      ttsEngine: "browser",
      talkSurface: "modal",
      // voiceId intentionally NOT in DEFAULTS — undefined means "let the catalog
      // resolve at point of use", so a v1.6 stored payload upgrades without picking
      // a different voice than v1.6 used (Joanna via the catalog default).
      voiceCharacter: DEFAULT_VOICE_CHARACTER,
    });
    expect(DEFAULT_VOICE_CHARACTER).toEqual({
      speed: "natural",
      tone: "neutral",
      pause: "normal",
    });
  });
});

describe("parse()", () => {
  it("returns DEFAULTS for null (no stored value)", () => {
    expect(parse(null)).toEqual(DEFAULTS);
  });

  it("returns DEFAULTS for malformed JSON (never throws)", () => {
    expect(parse("{not json")).toEqual(DEFAULTS);
  });

  it("round-trips a full valid payload", () => {
    const full = {
      micEnabled: true,
      ttsEnabled: true,
      wakeWord: true,
      captions: false,
      sttEngine: "transcribe",
      ttsEngine: "polly",
      talkSurface: "view",
      voiceId: "polly-generative-stephen",
      voiceCharacter: { speed: "fast", tone: "warm", pause: "tight" },
    };
    expect(parse(JSON.stringify(full))).toEqual(full);
  });

  it("upgrades a partial payload field-by-field (older/missing keys -> defaults)", () => {
    // Simulates a payload written before `wakeWord`/`talkSurface` existed.
    const partial = parse(JSON.stringify({ micEnabled: true, ttsEnabled: true }));
    expect(partial.micEnabled).toBe(true);
    expect(partial.ttsEnabled).toBe(true);
    expect(partial.wakeWord).toBe(false); // filled from defaults
    expect(partial.talkSurface).toBe("modal");
    expect(partial.sttEngine).toBe("browser");
    expect(partial.voiceCharacter).toEqual(DEFAULT_VOICE_CHARACTER);
    expect(partial.voiceId).toBeUndefined();
  });

  it("rejects invalid enum values, falling back to the safe default", () => {
    const bad = parse(JSON.stringify({ sttEngine: "whisper", ttsEngine: 42, talkSurface: "popup" }));
    expect(bad.sttEngine).toBe("browser");
    expect(bad.ttsEngine).toBe("browser");
    expect(bad.talkSurface).toBe("modal");
  });

  it("coerces a non-boolean toggle to its default", () => {
    const bad = parse(JSON.stringify({ micEnabled: "yes", wakeWord: 1 }));
    expect(bad.micEnabled).toBe(false);
    expect(bad.wakeWord).toBe(false);
  });
});

describe("ttsEngine accepts the new 'google' value (v1.7)", () => {
  it("accepts 'google' as a valid engine", () => {
    const r = parse(JSON.stringify({ ttsEngine: "google" }));
    expect(r.ttsEngine).toBe("google");
  });

  it("legacy 'polly' payload still parses unchanged", () => {
    const r = parse(JSON.stringify({ ttsEngine: "polly" }));
    expect(r.ttsEngine).toBe("polly");
  });

  it("legacy 'browser' payload still parses unchanged", () => {
    const r = parse(JSON.stringify({ ttsEngine: "browser" }));
    expect(r.ttsEngine).toBe("browser");
  });

  it("unknown engine values fall back to browser", () => {
    expect(parse(JSON.stringify({ ttsEngine: "elevenlabs" })).ttsEngine).toBe("browser");
  });
});

describe("voiceId — optional, validated, drops invalid silently", () => {
  it("a valid voiceId persists", () => {
    const r = parse(JSON.stringify({ voiceId: "polly-generative-stephen" }));
    expect(r.voiceId).toBe("polly-generative-stephen");
  });

  it("missing voiceId resolves to undefined (NOT a hardcoded default — catalog handles that)", () => {
    const r = parse(JSON.stringify({ ttsEngine: "polly" }));
    expect(r.voiceId).toBeUndefined();
  });

  it("non-string voiceId drops to undefined", () => {
    const r = parse(JSON.stringify({ voiceId: 42 }));
    expect(r.voiceId).toBeUndefined();
  });

  it("empty-string voiceId drops to undefined", () => {
    const r = parse(JSON.stringify({ voiceId: "" }));
    expect(r.voiceId).toBeUndefined();
  });

  it("absurdly-long voiceId drops to undefined (defense-in-depth)", () => {
    const r = parse(JSON.stringify({ voiceId: "x".repeat(200) }));
    expect(r.voiceId).toBeUndefined();
  });
});

describe("voiceCharacter — typed enum, partial validation per field", () => {
  it("a valid character persists", () => {
    const c = { speed: "fast", tone: "warm", pause: "tight" };
    const r = parse(JSON.stringify({ voiceCharacter: c }));
    expect(r.voiceCharacter).toEqual(c);
  });

  it("missing voiceCharacter falls back to DEFAULT_VOICE_CHARACTER", () => {
    const r = parse(JSON.stringify({ ttsEngine: "polly" }));
    expect(r.voiceCharacter).toEqual(DEFAULT_VOICE_CHARACTER);
  });

  it("partial voiceCharacter fills missing fields from defaults", () => {
    const r = parse(JSON.stringify({ voiceCharacter: { speed: "fast" } }));
    expect(r.voiceCharacter).toEqual({
      speed: "fast",
      tone: DEFAULT_VOICE_CHARACTER.tone,
      pause: DEFAULT_VOICE_CHARACTER.pause,
    });
  });

  it("invalid voiceCharacter values fall back to defaults per field", () => {
    const r = parse(
      JSON.stringify({ voiceCharacter: { speed: "warp-speed", tone: 42, pause: null } }),
    );
    expect(r.voiceCharacter).toEqual(DEFAULT_VOICE_CHARACTER);
  });

  it("non-object voiceCharacter falls back to DEFAULT_VOICE_CHARACTER", () => {
    expect(parse(JSON.stringify({ voiceCharacter: "fast" })).voiceCharacter).toEqual(
      DEFAULT_VOICE_CHARACTER,
    );
    expect(parse(JSON.stringify({ voiceCharacter: null })).voiceCharacter).toEqual(
      DEFAULT_VOICE_CHARACTER,
    );
  });
});

describe("v1.6 → v1.7 upgrade path (no migration)", () => {
  it("a stored v1.6 payload (no voiceId, no voiceCharacter) upgrades cleanly", () => {
    // The literal localStorage shape from v1.6 — no voice picker fields.
    const v16 = {
      micEnabled: true,
      ttsEnabled: true,
      wakeWord: false,
      captions: true,
      sttEngine: "browser",
      ttsEngine: "polly",
      talkSurface: "modal",
    };
    const r = parse(JSON.stringify(v16));
    // Old fields preserved verbatim.
    expect(r.micEnabled).toBe(true);
    expect(r.ttsEngine).toBe("polly");
    // New fields filled from defaults — no surprise behavior change.
    expect(r.voiceId).toBeUndefined();
    expect(r.voiceCharacter).toEqual(DEFAULT_VOICE_CHARACTER);
  });
});
