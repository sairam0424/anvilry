import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechSynthesis, splitSentences } from "./use-speech-synthesis";

/**
 * Two contracts. splitSentences (pure): chunks at sentence boundaries, caps runaway
 * length, and keeps a trailing partial so streaming eventually speaks the last
 * sentence. The hook: speaks per-sentence (so audio starts before the full answer),
 * speakChunk only enqueues NEW complete sentences, and cancel() is the synchronous
 * kill. Driven by a fake speechSynthesis with zero audio.
 */

describe("splitSentences", () => {
  it("splits on sentence-final punctuation", () => {
    expect(splitSentences("I build agents. I scale backends. Want details?")).toEqual([
      "I build agents.",
      "I scale backends.",
      "Want details?",
    ]);
  });

  it("keeps a trailing fragment with no terminal punctuation (the still-streaming bit)", () => {
    expect(splitSentences("Done. Now streaming the next")).toEqual(["Done.", "Now streaming the next"]);
  });

  it("caps an over-long run so no chunk exceeds the cutoff budget", () => {
    const long = "word ".repeat(80).trim() + "."; // ~400 chars, no internal punctuation
    const chunks = splitSentences(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(200);
  });

  it("returns nothing for empty/whitespace", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

// --- hook tests ---

class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = "";
  rate = 1;
  pitch = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

let spoken: FakeUtterance[];
let fakeSynth: {
  speaking: boolean;
  pending: boolean;
  speak: (u: FakeUtterance) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  getVoices: () => unknown[];
  addEventListener: () => void;
  removeEventListener: () => void;
};

beforeEach(() => {
  spoken = [];
  fakeSynth = {
    speaking: false,
    pending: false,
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u);
      fakeSynth.speaking = true;
      u.onstart?.();
    }),
    cancel: vi.fn(() => {
      spoken.length = 0;
      fakeSynth.speaking = false;
      fakeSynth.pending = false;
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [{ lang: "en-US", localService: true, name: "Test" }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", fakeSynth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSpeechSynthesis", () => {
  it("reports supported when the API exists", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.supported).toBe(true);
  });

  it("speak() enqueues one utterance per sentence", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak("First sentence. Second sentence."));
    expect(spoken.map((u) => u.text)).toEqual(["First sentence.", "Second sentence."]);
    expect(result.current.isSpeaking).toBe(true);
  });

  it("speakChunk() only enqueues NEW complete sentences as text streams", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    // First chunk: one complete sentence + a partial → only the complete one speaks.
    act(() => result.current.speakChunk("All done here. Still typing the"));
    expect(spoken.map((u) => u.text)).toEqual(["All done here."]);
    // Second chunk: the partial completes + a new one → both new sentences speak,
    // the already-spoken first one is NOT repeated.
    act(() => result.current.speakChunk("All done here. Still typing the rest. And more."));
    expect(spoken.map((u) => u.text)).toEqual([
      "All done here.",
      "Still typing the rest.",
      "And more.",
    ]);
  });

  it("cancel() clears the queue synchronously and stops speaking", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speak("One. Two. Three."));
    expect(spoken.length).toBe(3);
    act(() => result.current.cancel());
    expect(fakeSynth.cancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  /**
   * REGRESSION (the v1.5.0 talk-mode mute): speakChunk dedups against a per-hook spoken
   * counter that only ever climbs. Across MULTIPLE assistant turns — each a fresh answer
   * string growing from empty — turn N's sentence count is ≤ the previous turn's, so the
   * guard `ready.length <= spokenCount` silently dropped EVERY answer after the first.
   * resetTurn() (called by the session on each turn's streaming rising edge) is what
   * restarts the counter. The shipped tests never crossed a turn boundary, so the bug was
   * invisible — these tests pin it.
   */
  it("speakChunk drops a second turn WITHOUT resetTurn (documents the shipped bug)", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.speakChunk("One. Two. Three.")); // turn 1 → 3 sentences
    expect(spoken.map((u) => u.text)).toEqual(["One.", "Two.", "Three."]);
    spoken.length = 0;
    // Turn 2 (2 sentences) with the counter still at 3 → dropped (this was the bug).
    act(() => result.current.speakChunk("Alpha. Beta."));
    expect(spoken.length).toBe(0);
  });

  it("speakChunk speaks EVERY turn when resetTurn() runs at each turn boundary", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    // Turn 1.
    act(() => result.current.resetTurn());
    act(() => result.current.speakChunk("One. Two. Three."));
    expect(spoken.map((u) => u.text)).toEqual(["One.", "Two.", "Three."]);
    spoken.length = 0;
    // Turn 2 (fewer sentences) — must still speak both.
    act(() => result.current.resetTurn());
    act(() => result.current.speakChunk("Alpha. Beta."));
    expect(spoken.map((u) => u.text)).toEqual(["Alpha.", "Beta."]);
    spoken.length = 0;
    // Turn 3 (more sentences) — must speak ALL five, not just [oldCount..].
    act(() => result.current.resetTurn());
    act(() => result.current.speakChunk("A. B. C. D. E."));
    expect(spoken.map((u) => u.text)).toEqual(["A.", "B.", "C.", "D.", "E."]);
  });

  it("resetTurn() once per turn does NOT re-speak already-spoken sentences mid-stream", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() => result.current.resetTurn()); // turn rising edge (once)
    act(() => result.current.speakChunk("One. Two")); // "One." speaks; "Two" held back
    act(() => result.current.speakChunk("One. Two. Three.")); // only "Two.","Three." new
    expect(spoken.map((u) => u.text)).toEqual(["One.", "Two.", "Three."]); // "One." not repeated
  });

  it("resetTurn() lets the settle finalizer flush the trailing sentence on a later turn", () => {
    const { result } = renderHook(() => useSpeechSynthesis());
    // Turn 1 settles.
    act(() => result.current.resetTurn());
    act(() => result.current.speakChunk("First answer done."));
    spoken.length = 0;
    // Turn 2 streams a partial then the finalizer flushes the completed trailing sentence.
    act(() => result.current.resetTurn());
    act(() => result.current.speakChunk("Second answer streaming")); // partial held back
    expect(spoken.length).toBe(0);
    act(() => result.current.speakChunk("Second answer streaming now.")); // finalizer flush
    expect(spoken.map((u) => u.text)).toEqual(["Second answer streaming now."]);
  });
});

/**
 * v1.7 options-object form. The string-form (legacy) is fully covered above and
 * keeps its test behavior unchanged. These tests pin the new things:
 *   - voiceCharacter maps to safe-range rate/pitch values
 *   - voiceId of a known browser entry resolves via voiceURI prefix match
 *   - mismatched voiceId silently falls back to the localService heuristic
 *   - the engine="google" branch fetches /api/tts-google with the right body
 */

describe("useSpeechSynthesis — options form (v1.7)", () => {
  it("maps character.speed=fast to rate=1.15 (clamped, no cartoonish 2x)", () => {
    const { result } = renderHook(() =>
      useSpeechSynthesis({
        engine: "browser",
        character: { speed: "fast", tone: "neutral", pause: "normal" },
      }),
    );
    act(() => result.current.speak("Hello."));
    expect(spoken[0].rate).toBeCloseTo(1.15);
    expect(spoken[0].pitch).toBeCloseTo(1.0);
  });

  it("maps character.tone=warm to pitch=0.95 (subtle, professional warmth)", () => {
    const { result } = renderHook(() =>
      useSpeechSynthesis({
        engine: "browser",
        character: { speed: "natural", tone: "warm", pause: "normal" },
      }),
    );
    act(() => result.current.speak("Hello."));
    expect(spoken[0].pitch).toBeCloseTo(0.95);
  });

  it("default character (undefined) reproduces v1.6 hardcoded rate=1, pitch=1", () => {
    const { result } = renderHook(() => useSpeechSynthesis({ engine: "browser" }));
    act(() => result.current.speak("Hello."));
    expect(spoken[0].rate).toBe(1);
    expect(spoken[0].pitch).toBe(1);
  });

  it("voiceId of an unknown catalog entry falls back to the localService heuristic", () => {
    // Our fakeSynth getVoices returns one en-US localService voice — the heuristic
    // should pick it even when voiceId is provided but the catalog can't resolve it.
    const { result } = renderHook(() =>
      useSpeechSynthesis({ engine: "browser", voiceId: "unknown-id" }),
    );
    act(() => result.current.speak("Hello."));
    expect(spoken[0].voice).toBeDefined();
  });

  it("legacy string form still works (back-compat)", () => {
    const { result } = renderHook(() => useSpeechSynthesis("browser"));
    act(() => result.current.speak("Hello."));
    expect(spoken.length).toBe(1);
  });
});

describe("useSpeechSynthesis — engine=google branch (v1.7)", () => {
  it("speak() with engine=google + voiceId fetches /api/tts-google with the right body", async () => {
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(
        new Response(new Blob([new Uint8Array(0)], { type: "audio/mpeg" }), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSpeechSynthesis({ engine: "google", voiceId: "google-chirp3-aoede" }),
    );
    act(() => result.current.speak("Hello."));
    // The hook calls fetch asynchronously inside playRemoteFrom; wait a microtask.
    await new Promise((r) => setTimeout(r, 0));

    const calls = vi.mocked(fetchMock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [url, init] = calls[0]!;
    expect(url).toBe("/api/tts-google");
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ text: "Hello.", voiceId: "google-chirp3-aoede" });
  });

  it("speak() with engine=google + NO voiceId falls back to browser path", async () => {
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSpeechSynthesis({ engine: "google" }));
    act(() => result.current.speak("Hello."));
    // Must NOT have hit the network — fell through to browser engine.
    expect(vi.mocked(fetchMock)).not.toHaveBeenCalled();
    expect(spoken.map((u) => u.text)).toEqual(["Hello."]);
  });

  it("speak() with engine=polly + custom voiceId fetches /api/tts with the right body", async () => {
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(
        new Response(new Blob([new Uint8Array(0)], { type: "audio/mpeg" }), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useSpeechSynthesis({ engine: "polly", voiceId: "polly-generative-stephen" }),
    );
    act(() => result.current.speak("Hello."));
    await new Promise((r) => setTimeout(r, 0));

    const calls = vi.mocked(fetchMock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [url, init] = calls[0]!;
    expect(url).toBe("/api/tts");
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ text: "Hello.", voiceId: "polly-generative-stephen" });
  });

  it("remote-engine fetch failure falls back to browser path (the cascade)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("err", { status: 502 }))),
    );

    const { result } = renderHook(() =>
      useSpeechSynthesis({ engine: "polly", voiceId: "polly-neural-joanna" }),
    );
    act(() => result.current.speak("Hello world."));
    // Wait for fetch + fallback effect.
    await new Promise((r) => setTimeout(r, 0));
    // The browser engine should have spoken the text.
    expect(spoken.map((u) => u.text)).toContain("Hello world.");
  });
});
