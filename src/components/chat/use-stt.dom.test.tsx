import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * useStt picks the engine and provides transparent fallback: "browser" -> browser
 * engine; "transcribe" -> Transcribe IF supported, else fall back to the browser
 * engine (so a visitor who picked Transcribe on a device where it can't run still gets
 * the browser path). Both underlying hooks are always called (Rules of Hooks).
 */

const browser = { supported: true, isListening: false, interim: "b", error: null, start: vi.fn(), stop: vi.fn() };
const transcribe = { supported: true, isListening: false, interim: "t", error: null, start: vi.fn(), stop: vi.fn() };

vi.mock("@/components/chat/use-speech-recognition", () => ({ useSpeechRecognition: () => browser }));
vi.mock("@/components/chat/use-transcribe-recognition", () => ({ useTranscribeRecognition: () => transcribe }));

import { useStt } from "./use-stt";

beforeEach(() => {
  browser.supported = true;
  transcribe.supported = true;
});

describe("useStt engine selection", () => {
  it("returns the browser engine by default", () => {
    const { result } = renderHook(() => useStt("browser"));
    expect(result.current.interim).toBe("b");
  });

  it("returns the Transcribe engine when selected and supported", () => {
    const { result } = renderHook(() => useStt("transcribe"));
    expect(result.current.interim).toBe("t");
  });

  it("falls back to the browser engine when Transcribe is selected but unsupported", () => {
    transcribe.supported = false;
    const { result } = renderHook(() => useStt("transcribe"));
    expect(result.current.interim).toBe("b");
  });
});
