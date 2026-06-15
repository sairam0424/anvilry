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
});
