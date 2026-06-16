import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { VoicePicker } from "./voice-picker";
import { CURATED_VOICES } from "@/lib/voice-catalog";

/**
 * VoicePicker contract tests. Mock the TTS hook so the picker's preview button
 * triggers an observable side effect (speak()) without needing an audio context
 * or a real fetch. The two layout modes (descriptor vs gender) flip on the
 * NEXT_PUBLIC_VOICE_PICKER_MODE env value, which is read once at module load —
 * we'd need to vi.resetModules + import dynamically to flip it inside one test
 * run, so the layout-mode behavior is verified by the gender column resolver
 * in the catalog tests instead.
 */

const speak = vi.fn();
const cancel = vi.fn();
vi.mock("@/components/chat/use-speech-synthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    isSpeaking: false,
    speak,
    speakChunk: vi.fn(),
    cancel,
    resetTurn: vi.fn(),
  }),
}));

beforeEach(() => {
  speak.mockReset();
  cancel.mockReset();
  cleanup();
});

describe("VoicePicker — inline mode (descriptor layout — default)", () => {
  it("renders one card per curated voice (6)", () => {
    render(<VoicePicker mode="inline" onPick={() => {}} />);
    for (const v of CURATED_VOICES) {
      expect(screen.getByLabelText(`Pick voice ${v.displayName}`)).toBeTruthy();
    }
  });

  it("highlights the current voice via aria-pressed", () => {
    render(
      <VoicePicker
        mode="inline"
        currentVoiceId="polly-generative-stephen"
        onPick={() => {}}
      />,
    );
    const stephen = screen.getByLabelText("Pick voice Stephen");
    expect(stephen.getAttribute("aria-pressed")).toBe("true");
    const joanna = screen.getByLabelText("Pick voice Joanna");
    expect(joanna.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking a voice card fires onPick with the catalog id", () => {
    const onPick = vi.fn();
    render(<VoicePicker mode="inline" onPick={onPick} />);
    fireEvent.click(screen.getByLabelText("Pick voice Stephen"));
    expect(onPick).toHaveBeenCalledWith("polly-generative-stephen");
  });

  it("tapping the preview button speaks the entry's sampleText", async () => {
    render(<VoicePicker mode="inline" onPick={() => {}} />);
    fireEvent.click(screen.getByLabelText("Preview voice Stephen"));
    // queueMicrotask defers the speak() call by one tick so the engine flips first.
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0]).toContain("Stephen");
  });

  it("tapping a different voice's preview cancels the prior + starts the new", async () => {
    render(<VoicePicker mode="inline" onPick={() => {}} />);
    fireEvent.click(screen.getByLabelText("Preview voice Stephen"));
    await new Promise((r) => queueMicrotask(() => r(undefined)));

    fireEvent.click(screen.getByLabelText("Preview voice Joanna"));
    await new Promise((r) => queueMicrotask(() => r(undefined)));

    // cancel() ran at least twice — once when Stephen started (clearing any
    // prior session), once when switching to Joanna.
    expect(cancel.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(speak.mock.calls.length).toBe(2);
    expect(speak.mock.calls[1][0]).toContain("Joanna");
  });

  it("tapping the SAME preview again stops it (toggle behavior)", async () => {
    render(<VoicePicker mode="inline" onPick={() => {}} />);
    fireEvent.click(screen.getByLabelText("Preview voice Stephen"));
    await new Promise((r) => queueMicrotask(() => r(undefined)));
    cancel.mockClear();

    fireEvent.click(screen.getByLabelText("Preview voice Stephen"));
    // No new speak() — only a cancel().
    expect(cancel).toHaveBeenCalled();
  });

  it("renders a 'More voices…' overflow trigger", () => {
    render(<VoicePicker mode="inline" onPick={() => {}} />);
    const overflow = screen.getByText("More voices…");
    expect(overflow).toBeTruthy();
  });
});

describe("VoicePicker — dialog mode", () => {
  it("renders nothing when open=false", () => {
    render(
      <VoicePicker
        mode="dialog"
        open={false}
        onOpenChange={() => {}}
        onPick={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Pick voice Stephen")).toBeNull();
  });

  it("shows the picker grid when open=true", () => {
    render(
      <VoicePicker
        mode="dialog"
        open={true}
        onOpenChange={() => {}}
        onPick={() => {}}
      />,
    );
    expect(screen.getByLabelText("Pick voice Stephen")).toBeTruthy();
  });

  it("picking a voice in dialog mode also closes the dialog", () => {
    const onOpenChange = vi.fn();
    const onPick = vi.fn();
    render(
      <VoicePicker
        mode="dialog"
        open={true}
        onOpenChange={onOpenChange}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByLabelText("Pick voice Joanna"));
    expect(onPick).toHaveBeenCalledWith("polly-neural-joanna");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("VoicePicker — accessibility", () => {
  it("exposes a sr-only aria-live announcement region", () => {
    const { container } = render(<VoicePicker mode="inline" onPick={() => {}} />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.getAttribute("aria-atomic")).toBe("true");
    expect(live?.classList.contains("sr-only")).toBe(true);
  });

  it("each preview button is labeled with the voice name", () => {
    render(<VoicePicker mode="inline" onPick={() => {}} />);
    for (const v of CURATED_VOICES) {
      expect(screen.getByLabelText(`Preview voice ${v.displayName}`)).toBeTruthy();
    }
  });
});
