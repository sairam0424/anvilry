import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MicButton } from "./mic-button";
import { __resetVoiceSettingsForTest } from "@/lib/voice-settings-context";

/**
 * The mic button is the user-facing privacy surface. Contract: (1) renders NOTHING
 * when Web Speech is unsupported (text composer untouched); (2) the FIRST activation
 * shows the cloud-audio disclosure and does NOT open the mic until accepted; (3) once
 * accepted (persisted), later clicks start listening directly; (4) aria-pressed
 * reflects the listening state. Driven by a fake engine + stubbed getUserMedia.
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
}

let fakeRec: FakeRecognition;

function stubSupported() {
  fakeRec = new FakeRecognition();
  vi.stubGlobal(
    "SpeechRecognition",
    class {
      constructor() {
        return fakeRec;
      }
    },
  );
  vi.stubGlobal("navigator", {
    ...globalThis.navigator,
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream),
    },
  });
}

beforeEach(() => {
  __resetVoiceSettingsForTest();
  try {
    window.localStorage.clear();
  } catch {
    /* happy-dom may not expose localStorage in every env — best effort */
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MicButton", () => {
  it("renders nothing when Web Speech is unsupported (degrade to text)", () => {
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    const { container } = render(<MicButton onText={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the cloud-audio disclosure on first use and does NOT open the mic yet", async () => {
    stubSupported();
    render(<MicButton onText={vi.fn()} />);

    const mic = await screen.findByRole("button", { name: "Ask by voice" });
    fireEvent.click(mic);

    // Disclosure dialog appears; the mic engine has NOT started.
    expect(screen.getByRole("dialog", { name: /microphone privacy notice/i })).toBeTruthy();
    expect(fakeRec.start).not.toHaveBeenCalled();
  });

  it("starts listening after the disclosure is accepted, and toggles aria-pressed", async () => {
    stubSupported();
    render(<MicButton onText={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ask by voice" }));
    fireEvent.click(screen.getByRole("button", { name: "Use microphone" }));

    // getUserMedia resolves → engine starts → button flips to the listening state.
    await waitFor(() => expect(fakeRec.start).toHaveBeenCalled());
    const stopBtn = await screen.findByRole("button", { name: "Stop listening" });
    expect(stopBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("'Not now' dismisses the disclosure without opening the mic", async () => {
    stubSupported();
    render(<MicButton onText={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Ask by voice" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fakeRec.start).not.toHaveBeenCalled();
  });
});
