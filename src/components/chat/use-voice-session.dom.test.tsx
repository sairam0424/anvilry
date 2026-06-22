import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * The talk-mode state machine orchestrates three hooks (chat transport, STT, TTS) and
 * DERIVES its `state` from their live signals (recog.isListening / chat.isStreaming /
 * synth.isSpeaking). We mock all three and flip those signals to drive transitions,
 * asserting the contract: start -> listening; final transcript -> send(); stream
 * settles -> speak() (mic off first, no self-hearing); speech ends -> listen again;
 * stop -> idle + torn down; interrupt -> cancel speech + listen.
 */

// --- mock the three dependency hooks (hoisted: vi.mock runs before imports) ---
const chat = {
  messages: [] as { role: string; content: string }[],
  send: vi.fn(),
  stop: vi.fn(),
  isStreaming: false,
};
const recog = {
  supported: true,
  isListening: false,
  interim: "",
  error: null as string | null,
  // start() flips isListening true (so the derived state reads "listening"); the real
  // hook does this when getUserMedia resolves.
  start: vi.fn(() => {
    recog.isListening = true;
  }),
  stop: vi.fn(() => {
    recog.isListening = false;
  }),
};
const synth = {
  supported: true,
  isSpeaking: false,
  speak: vi.fn(),
  speakChunk: vi.fn(),
  cancel: vi.fn(),
  resetTurn: vi.fn(),
};

// Return a FRESH object literal each render (spreading the shared vi.fn() refs so
// assertions still target the same spies). This mirrors the real hooks, which return new
// objects every render — the identity churn that caused the "cancel-every-render" audio
// bug. A stable mock object hid it; this exposes it.
vi.mock("@/components/chat/use-chat", () => ({ useChat: () => ({ ...chat }) }));
vi.mock("@/components/chat/use-speech-recognition", () => ({ useSpeechRecognition: () => ({ ...recog }) }));
vi.mock("@/components/chat/use-speech-synthesis", () => ({ useSpeechSynthesis: () => ({ ...synth }) }));

import { useVoiceSession } from "./use-voice-session";

beforeEach(() => {
  chat.messages = [];
  chat.isStreaming = false;
  chat.send.mockClear();
  chat.stop.mockClear();
  recog.supported = true;
  recog.error = null;
  recog.isListening = false;
  recog.start.mockClear();
  recog.stop.mockClear();
  synth.isSpeaking = false;
  synth.speak.mockClear();
  synth.speakChunk.mockClear();
  synth.cancel.mockClear();
  synth.resetTurn.mockClear();
});

describe("useVoiceSession", () => {
  it("start() opens the session and begins listening", () => {
    const { result } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.state).toBe("listening");
    expect(recog.start).toHaveBeenCalledTimes(1);
  });

  it("ask() opens the session, stops the mic, and sends via the session's own send()", () => {
    // The Anvil view's prompt chips call ask(text) — it must route through THIS
    // session's send (one transcript, one mic), activating without a prior start().
    const { result } = renderHook(() => useVoiceSession());
    expect(result.current.active).toBe(false);
    act(() => result.current.ask("What did you build at Ascendion?"));
    expect(result.current.active).toBe(true); // session opened by the chip
    expect(recog.stop).toHaveBeenCalled(); // mic off while we send + speak (no self-hearing)
    expect(chat.send).toHaveBeenCalledWith("What did you build at Ascendion?");
  });

  it("ask() ignores an empty/whitespace prompt (no stray send)", () => {
    const { result } = renderHook(() => useVoiceSession());
    act(() => result.current.ask("   "));
    expect(chat.send).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it("a final transcript sends to the chat (then the stream drives 'thinking')", () => {
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    // Invoke the onFinal callback recognition.start was given.
    const onFinal = (recog.start.mock.calls[0] as unknown as [(t: string) => void])[0];
    act(() => {
      onFinal("what is your strongest project");
      // The real transport flips isStreaming true on send; mirror that.
      recog.isListening = false;
      chat.isStreaming = true;
    });
    act(() => rerender());
    expect(chat.send).toHaveBeenCalledWith("what is your strongest project");
    expect(result.current.state).toBe("thinking"); // derived from isStreaming
  });

  it("speaks AS the answer streams (speakChunk per growing chunk, not after settle)", () => {
    chat.isStreaming = true;
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    // A partial answer arrives WHILE still streaming.
    chat.messages = [
      { role: "user", content: "tell me about mindforge" },
      { role: "assistant", content: "MindForge is an agentic framework." },
    ];
    act(() => rerender());
    // It spoke the chunk DURING the stream (card tokens stripped), not waiting for settle.
    expect(synth.speakChunk).toHaveBeenCalledWith("MindForge is an agentic framework.");
  });

  it("resets the TTS dedup counter once at each new turn's streaming rising edge", () => {
    chat.isStreaming = true;
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    // Turn 1 begins streaming → resetTurn() fires once before the first speakChunk.
    chat.messages = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "Answer one." },
    ];
    act(() => rerender());
    expect(synth.resetTurn).toHaveBeenCalledTimes(1);
    // More tokens of the SAME turn must NOT reset again (would re-speak sentence 1).
    chat.messages = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "Answer one. And more." },
    ];
    act(() => rerender());
    expect(synth.resetTurn).toHaveBeenCalledTimes(1);
    // Stream settles, then a SECOND turn starts streaming → resetTurn re-arms and fires.
    chat.isStreaming = false;
    act(() => rerender());
    chat.isStreaming = true;
    chat.messages = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "Answer one. And more." },
      { role: "user", content: "q2" },
      { role: "assistant", content: "Second answer." },
    ];
    act(() => rerender());
    expect(synth.resetTurn).toHaveBeenCalledTimes(2);
  });

  it("does NOT cancel TTS on re-renders during a normal turn (the cancel-every-render bug)", () => {
    chat.isStreaming = true;
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    // Several streamed-token re-renders of the SAME turn — the teardown effect must NOT
    // re-run its cleanup (which calls tts.cancel() and would clear the speech queue +
    // zero the dedup counter on every render → total silence). Regression guard: the
    // teardown deps must be [] (empty), not [recognition, tts] (fresh objects each render).
    chat.messages = [
      { role: "user", content: "q" },
      { role: "assistant", content: "MindForge is an agentic framework." },
    ];
    act(() => rerender());
    chat.messages = [
      { role: "user", content: "q" },
      { role: "assistant", content: "MindForge is an agentic framework. It scales backends." },
    ];
    act(() => rerender());
    act(() => rerender());
    // start() itself never cancels; only stop/interrupt/pause/unmount do. So across a
    // whole streaming turn, cancel must be untouched.
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it("the settle finalizer uses speakChunk (NOT speak) so it never re-speaks", () => {
    chat.isStreaming = true;
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    chat.messages = [
      { role: "user", content: "q" },
      { role: "assistant", content: "MindForge is an agentic framework. [[card:project:mindforge]]" },
    ];
    // Stream settles + the engine is speaking.
    chat.isStreaming = false;
    synth.isSpeaking = true;
    act(() => rerender());
    // Finalizer flushes via speakChunk (card token stripped); speak() is NEVER called
    // (speak() would cancel + reset the counter and re-speak the whole answer).
    expect(synth.speakChunk).toHaveBeenCalledWith("MindForge is an agentic framework.");
    expect(synth.speak).not.toHaveBeenCalled();
    expect(result.current.state).toBe("speaking");
  });

  it("after speech ends it loops back to listening", () => {
    synth.isSpeaking = true;
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    recog.start.mockClear();

    // Speech finishes.
    synth.isSpeaking = false;
    act(() => rerender());
    expect(recog.start).toHaveBeenCalled(); // re-listened
    expect(result.current.state).toBe("listening"); // derived from isListening
  });

  it("an idle mic on an active session reads as 'paused' (e.g. after no-speech)", () => {
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    // Recognition ends with no result (no-speech) — mic goes idle, nothing else active.
    act(() => {
      recog.isListening = false;
      recog.error = "no-speech";
    });
    act(() => rerender());
    expect(result.current.state).toBe("paused");
  });

  it("interrupt() cancels speech, ABORTS the in-flight stream, and listens again", () => {
    const { result } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    act(() => result.current.interrupt());
    expect(synth.cancel).toHaveBeenCalled();
    // With speak-as-it-streams a tap can land mid-stream, so interrupt must also abort
    // the /api/chat fetch (useChat.stop) — not just cancel TTS.
    expect(chat.stop).toHaveBeenCalled();
    expect(recog.start).toHaveBeenCalledTimes(2); // initial + after interrupt
  });

  it("stop() tears everything down to idle", () => {
    const { result } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current.active).toBe(false);
    expect(result.current.state).toBe("idle");
    expect(recog.stop).toHaveBeenCalled();
    expect(synth.cancel).toHaveBeenCalled();
    expect(chat.stop).toHaveBeenCalled();
  });

  it("reports unsupported when recognition is unavailable; start() is a no-op", () => {
    recog.supported = false;
    const { result } = renderHook(() => useVoiceSession());
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(result.current.active).toBe(false);
    expect(recog.start).not.toHaveBeenCalled();
  });
});
