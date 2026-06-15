import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * TalkMode is the presentational surface over useVoiceSession. We mock the session so
 * we can assert the UI contract per state: unsupported -> a "type instead" fallback;
 * the primary control's accessible label tracks the turn (start / stop-speaking /
 * resume / mute); the live transcript caption is rendered (voice never the only
 * channel); Esc closes; and End tears the session down + closes.
 */

const session = {
  supported: true,
  active: false,
  state: "idle" as string,
  interim: "",
  messages: [] as { role: string; content: string }[],
  isStreaming: false,
  error: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
  interrupt: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

vi.mock("@/components/chat/use-voice-session", async (orig) => {
  const actual = await orig<typeof import("./use-voice-session")>();
  return { ...actual, useVoiceSession: () => session };
});

import { TalkMode } from "./talk-mode";

beforeEach(() => {
  session.supported = true;
  session.active = false;
  session.state = "idle";
  session.interim = "";
  session.messages = [];
  for (const k of ["start", "stop", "interrupt", "pause", "resume"] as const) session[k].mockClear();
});

afterEach(cleanup);

describe("TalkMode", () => {
  it("shows a type-instead fallback when voice is unsupported", () => {
    session.supported = false;
    const onClose = vi.fn();
    render(<TalkMode onClose={onClose} />);
    expect(screen.getByText(/isn't available in this browser/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("offers 'Start voice conversation' when idle, and start() fires on click", () => {
    render(<TalkMode onClose={vi.fn()} />);
    const primary = screen.getByRole("button", { name: "Start voice conversation" });
    fireEvent.click(primary);
    expect(session.start).toHaveBeenCalled();
  });

  it("labels the primary control 'Stop speaking' while speaking and interrupts on click", () => {
    session.active = true;
    session.state = "speaking";
    render(<TalkMode onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop speaking" }));
    expect(session.interrupt).toHaveBeenCalled();
  });

  it("labels the primary control 'Mute microphone' while listening", () => {
    session.active = true;
    session.state = "listening";
    render(<TalkMode onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeTruthy();
  });

  it("renders the live interim transcript as a caption", () => {
    session.active = true;
    session.state = "listening";
    session.interim = "what is your strongest";
    render(<TalkMode onClose={vi.fn()} />);
    expect(screen.getByText("what is your strongest")).toBeTruthy();
  });

  it("renders the latest answer as a caption when not listening", () => {
    session.active = true;
    session.state = "speaking";
    session.messages = [
      { role: "user", content: "q" },
      { role: "assistant", content: "I build agent backends." },
    ];
    render(<TalkMode onClose={vi.fn()} />);
    expect(screen.getByText("I build agent backends.")).toBeTruthy();
  });

  it("Esc closes the surface", () => {
    const onClose = vi.fn();
    render(<TalkMode onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("End stops the session and closes", () => {
    session.active = true;
    session.state = "listening";
    const onClose = vi.fn();
    render(<TalkMode onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "End voice conversation" }));
    expect(session.stop).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
