import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * The wake-word controller's TRUST contract: off by default -> renders nothing (no hot
 * mic); enabling -> a cloud-audio disclosure shows and the mic is NOT armed until
 * accepted; accept -> the persistent "Listening" banner appears and the engine arms;
 * the banner's Stop disarms. We mock the hook + settings to drive these states.
 */

const wake = { supported: true, listening: false, arm: vi.fn(), disarm: vi.fn() };
const settings = { wakeWord: false, ttsEnabled: false, micEnabled: false, sttEngine: "browser", ttsEngine: "browser", talkSurface: "modal" };
const toggle = vi.fn();
const set = vi.fn((patch: Record<string, unknown>) => Object.assign(settings, patch));
const viewState = { view: "chat" };

vi.mock("@/components/chat/use-wake-word", () => ({ useWakeWord: () => wake }));
vi.mock("@/lib/voice-settings-context", () => ({ useVoiceSettings: () => ({ settings, toggle, set }) }));
vi.mock("@/components/view-context", () => ({ useView: () => viewState }));
const openTalkMode = vi.fn();
vi.mock("@/components/chat/talk-overlay-store", () => ({ openTalkMode: () => openTalkMode() }));

import { WakeWordController } from "./wake-word-controller";

beforeEach(() => {
  settings.wakeWord = false;
  wake.listening = false;
  viewState.view = "chat";
  wake.arm.mockClear();
  wake.disarm.mockClear();
  set.mockClear();
  toggle.mockClear();
});

afterEach(cleanup);

describe("WakeWordController", () => {
  it("renders nothing when the wake word is off (no hot mic by default)", () => {
    const { container } = render(<WakeWordController />);
    expect(container.firstChild).toBeNull();
    expect(wake.arm).not.toHaveBeenCalled();
  });

  it("shows a cloud-audio disclosure when enabled, and does NOT arm until accepted", () => {
    settings.wakeWord = true;
    render(<WakeWordController />);
    expect(screen.getByRole("dialog", { name: "Enable wake word" })).toBeTruthy();
    expect(screen.getByText(/streams the audio to its speech service/i)).toBeTruthy();
    // Mic not armed yet.
    expect(wake.arm).not.toHaveBeenCalled();
  });

  it("Cancel on the disclosure turns the pref back off", () => {
    settings.wakeWord = true;
    render(<WakeWordController />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(set).toHaveBeenCalledWith({ wakeWord: false });
  });

  it("accepting the disclosure arms the engine and shows the Listening banner", () => {
    settings.wakeWord = true;
    wake.listening = true; // the hook reports listening once armed
    render(<WakeWordController />);
    fireEvent.click(screen.getByRole("button", { name: "Enable listening" }));
    expect(wake.arm).toHaveBeenCalled();
    expect(screen.getByText(/Listening for/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Stop listening for the wake word/i })).toBeTruthy();
  });

  it("does not arm on a non-voice view even when enabled", () => {
    settings.wakeWord = true;
    viewState.view = "classic";
    const { container } = render(<WakeWordController />);
    // Not a voice view -> no disclosure, no banner, no arm.
    expect(container.firstChild).toBeNull();
    expect(wake.arm).not.toHaveBeenCalled();
  });
});
