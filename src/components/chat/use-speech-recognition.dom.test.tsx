import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSpeechRecognition } from "./use-speech-recognition";

/**
 * The hook is the privacy-critical STT primitive: it must (1) report `supported`
 * honestly so the UI can degrade to text, (2) never open the mic except on an
 * explicit start(), (3) release the mic (track.stop()) on stop/end, and (4) surface a
 * denied permission as a calm error, never a hang. We drive it with a fake
 * SpeechRecognition + a stubbed getUserMedia so it runs with zero hardware in CI.
 */

class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn(() => this.onend?.());
  // Test helper: simulate the engine producing a result.
  emit(transcript: string, isFinal: boolean) {
    this.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { 0: { transcript }, isFinal, length: 1 } },
    });
  }
}

let fakeRec: FakeRecognition;
const tracks = [{ stop: vi.fn() }];

beforeEach(() => {
  fakeRec = new FakeRecognition();
  // Must be `new`-able (the hook does `new Ctor()`), so a real class returning the
  // shared instance — not vi.fn(() => ...), which can't be a constructor.
  vi.stubGlobal(
    "SpeechRecognition",
    class {
      constructor() {
        return fakeRec;
      }
    },
  );
  // happy-dom has no mediaDevices — provide a resolving getUserMedia.
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => tracks }) as unknown as MediaStream),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  tracks[0].stop.mockClear();
});

describe("useSpeechRecognition", () => {
  it("reports supported when a SpeechRecognition ctor exists", async () => {
    const { result } = renderHook(() => useSpeechRecognition());
    await waitFor(() => expect(result.current.supported).toBe(true));
  });

  it("reports unsupported (degrade to text) when no ctor exists", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    const { result } = renderHook(() => useSpeechRecognition());
    // Give the mount effect a tick; supported should stay false.
    await act(async () => {});
    expect(result.current.supported).toBe(false);
  });

  it("does NOT open the mic until start() is called", async () => {
    const gum = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    renderHook(() => useSpeechRecognition());
    await act(async () => {});
    expect(gum).not.toHaveBeenCalled();
  });

  it("starts the engine and fires onFinal with the transcribed text", async () => {
    const { result } = renderHook(() => useSpeechRecognition());
    await waitFor(() => expect(result.current.supported).toBe(true));

    const onFinal = vi.fn();
    await act(async () => {
      result.current.start(onFinal);
    });
    // getUserMedia resolved → engine started.
    await waitFor(() => expect(fakeRec.start).toHaveBeenCalled());
    expect(result.current.isListening).toBe(true);

    // Interim result shows live; final result fires the callback.
    act(() => fakeRec.emit("what did you", false));
    expect(result.current.interim).toBe("what did you");
    act(() => fakeRec.emit("what did you build", true));
    expect(onFinal).toHaveBeenCalledWith("what did you build");
    expect(result.current.interim).toBe("");
  });

  it("releases the mic (track.stop) on stop()", async () => {
    const { result } = renderHook(() => useSpeechRecognition());
    await waitFor(() => expect(result.current.supported).toBe(true));
    await act(async () => result.current.start(vi.fn()));
    await waitFor(() => expect(fakeRec.start).toHaveBeenCalled());

    act(() => result.current.stop());
    expect(fakeRec.abort).toHaveBeenCalled();
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("surfaces a denied permission as a calm error, not a hang", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    const { result } = renderHook(() => useSpeechRecognition());
    await waitFor(() => expect(result.current.supported).toBe(true));
    await act(async () => result.current.start(vi.fn()));
    await waitFor(() => expect(result.current.error).toBe("denied"));
    expect(result.current.isListening).toBe(false);
  });
});
