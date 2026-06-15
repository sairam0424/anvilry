import { describe, it, expect } from "vitest";
import { DEFAULTS, parse } from "./voice-settings-context";

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
