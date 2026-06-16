import { describe, expect, it } from "vitest";
import {
  applePremiumIsMissing,
  isLinuxESpeak,
  localeFallbackChain,
  normalizeVoiceURI,
  voiceURIToGender,
} from "./voice-pitfalls";

/**
 * PURE-LOGIC unit tests (no window/navigator/localStorage). DOM-dependent
 * pitfall utilities (UA detection, getVoicesRaceHardened, first-run primer
 * storage, detectScreenReader) live in voice-pitfalls.dom.test.ts which runs
 * under happy-dom — keeping pure logic in node-env tests so the fast suite
 * doesn't pay the jsdom cold-start tax for assertions that don't need it.
 */

describe("voiceURIToGender — pitfall #4 (don't trust voice.gender)", () => {
  it("recognizes Microsoft Online Natural female voices on Edge", () => {
    expect(voiceURIToGender("Microsoft Aria Online (Natural)")).toBe("female");
    expect(voiceURIToGender("Microsoft Jenny Online (Natural)")).toBe("female");
  });

  it("recognizes Microsoft Online Natural male voices on Edge", () => {
    expect(voiceURIToGender("Microsoft Guy Online (Natural)")).toBe("male");
    expect(voiceURIToGender("Microsoft Davis Online (Natural)")).toBe("male");
  });

  it("recognizes Apple Premium voices by URI", () => {
    expect(voiceURIToGender("com.apple.voice.premium.en-US.Samantha")).toBe("female");
    expect(voiceURIToGender("com.apple.voice.premium.en-US.Tom")).toBe("male");
  });

  it("recognizes Google streamed voices", () => {
    expect(voiceURIToGender("Google US English Female")).toBe("female");
    expect(voiceURIToGender("Google UK English Male")).toBe("male");
  });

  it("returns undefined for unknown voiceURIs (caller falls back to default)", () => {
    expect(voiceURIToGender("Custom Local Voice")).toBeUndefined();
    expect(voiceURIToGender("eSpeak en-US")).toBeUndefined();
    expect(voiceURIToGender("")).toBeUndefined();
  });
});

describe("isLinuxESpeak — pitfall #3", () => {
  it("returns true when every voice is eSpeak", () => {
    const voices = [
      { voiceURI: "eSpeak en-US", name: "English (America)" },
      { voiceURI: "eSpeak en-GB", name: "English (Britain)" },
    ];
    expect(isLinuxESpeak(voices)).toBe(true);
  });

  it("returns true when voices have no name (some Linux configs)", () => {
    expect(isLinuxESpeak([{ voiceURI: "x", name: "" }])).toBe(true);
  });

  it("returns false when any non-eSpeak voice exists", () => {
    expect(
      isLinuxESpeak([
        { voiceURI: "eSpeak en-US", name: "eSpeak" },
        { voiceURI: "Microsoft Aria Online", name: "Aria" },
      ]),
    ).toBe(false);
  });

  it("returns false for empty list (don't false-positive a not-yet-loaded list)", () => {
    expect(isLinuxESpeak([])).toBe(false);
  });
});

describe("localeFallbackChain — pitfall #5", () => {
  it("en-IN falls through GB → AU → US", () => {
    expect(localeFallbackChain("en-IN")).toEqual(["en-IN", "en-GB", "en-AU", "en-US"]);
  });

  it("en-AU falls through GB → NZ → US", () => {
    expect(localeFallbackChain("en-AU")).toEqual(["en-AU", "en-GB", "en-NZ", "en-US"]);
  });

  it("unknown English variant falls back to en-US then any English", () => {
    expect(localeFallbackChain("en-XX")).toEqual(["en-XX", "en-US", "en"]);
  });

  it("non-English locale falls back to en-US", () => {
    expect(localeFallbackChain("fr-FR")).toEqual(["fr-FR", "en-US"]);
  });

  it("en-US returns en-US first (no degradation)", () => {
    expect(localeFallbackChain("en-US")[0]).toBe("en-US");
  });
});

describe("applePremiumIsMissing — pitfall #6", () => {
  it("returns true when an Apple Premium voiceURI is referenced but absent", () => {
    expect(
      applePremiumIsMissing("com.apple.voice.premium.en-US.Samantha", []),
    ).toBe(true);
  });

  it("returns false when the Apple Premium voice is present", () => {
    expect(
      applePremiumIsMissing("com.apple.voice.premium.en-US.Samantha", [
        { voiceURI: "com.apple.voice.premium.en-US.Samantha" },
      ]),
    ).toBe(false);
  });

  it("returns false for non-Apple-Premium URIs (other engines never trip this hint)", () => {
    expect(applePremiumIsMissing("Microsoft Aria Online", [])).toBe(false);
    expect(applePremiumIsMissing("Google US English Female", [])).toBe(false);
  });

  it("returns false when no URI is provided", () => {
    expect(applePremiumIsMissing(undefined, [])).toBe(false);
  });
});

describe("normalizeVoiceURI — pitfall #14", () => {
  it("strips Linux speech-dispatcher +m1 / +f3 modifiers", () => {
    expect(normalizeVoiceURI("Google US English+f3")).toBe("Google US English");
    expect(normalizeVoiceURI("eSpeak en-US+m1")).toBe("eSpeak en-US");
  });

  it("leaves URIs without modifiers unchanged", () => {
    expect(normalizeVoiceURI("Microsoft Aria Online")).toBe("Microsoft Aria Online");
    expect(normalizeVoiceURI("com.apple.voice.premium.en-US.Samantha")).toBe(
      "com.apple.voice.premium.en-US.Samantha",
    );
  });
});
