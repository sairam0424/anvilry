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
};

vi.mock("@/components/chat/use-chat", () => ({ useChat: () => chat }));
vi.mock("@/components/chat/use-speech-recognition", () => ({ useSpeechRecognition: () => recog }));
vi.mock("@/components/chat/use-speech-synthesis", () => ({ useSpeechSynthesis: () => synth }));

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
  synth.cancel.mockClear();
});

describe("useVoiceSession", () => {
  it("start() opens the session and begins listening", () => {
    const { result } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.state).toBe("listening");
    expect(recog.start).toHaveBeenCalledTimes(1);
  });

  it("a final transcript sends to the chat (then the stream drives 'thinking')", () => {
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    // Invoke the onFinal callback recognition.start was given.
    const onFinal = recog.start.mock.calls[0][0] as (t: string) => void;
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

  it("when the stream settles it speaks the grounded answer (mic off first)", () => {
    chat.isStreaming = true;
    const { result, rerender } = renderHook(() => useVoiceSession());
    act(() => result.current.start());

    // Stream produces an answer, then settles + the engine starts speaking.
    chat.messages = [
      { role: "user", content: "tell me about mindforge" },
      { role: "assistant", content: "MindForge is an agentic framework. [[card:project:mindforge]]" },
    ];
    chat.isStreaming = false;
    synth.isSpeaking = true; // the speak() call would flip this in the real hook
    act(() => rerender());

    // Card token stripped; only prose spoken.
    expect(synth.speak).toHaveBeenCalledWith("MindForge is an agentic framework.");
    // Mic was stopped before speaking (no self-hearing).
    expect(recog.stop).toHaveBeenCalled();
    expect(result.current.state).toBe("speaking"); // derived from isSpeaking
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

  it("interrupt() cancels speech and listens again", () => {
    const { result } = renderHook(() => useVoiceSession());
    act(() => result.current.start());
    act(() => result.current.interrupt());
    expect(synth.cancel).toHaveBeenCalled();
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
