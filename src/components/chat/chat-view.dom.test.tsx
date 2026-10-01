import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ChatView } from "./chat-view";
import { AI_CAPTION, NAMES_A_MODEL_OR_VENDOR } from "./ai-disclosure";
import { hiddenBy } from "./hidden-by.test-support";

const { send, consumePendingChatQuery, chatState } = vi.hoisted(() => ({
  send: vi.fn(),
  consumePendingChatQuery: vi.fn(),
  chatState: { messages: [] as { role: string; content: string }[] },
}));

vi.mock("@/components/chat/use-chat", () => ({
  useChat: () => ({
    messages: chatState.messages,
    send,
    stop: vi.fn(),
    isStreaming: false,
    pendingFiles: [],
    setPendingFiles: vi.fn(),
  }),
}));

vi.mock("@/components/view-context", () => ({
  consumePendingChatQuery,
}));

vi.mock("@/components/chat/chat-messages", () => ({
  ChatMessages: () => null,
}));
vi.mock("@/components/chat/mic-button", () => ({ MicButton: () => null }));
vi.mock("@/components/chat/talk-launch-button", () => ({
  TalkLaunchButton: () => null,
}));
vi.mock("@/components/chat/file-picker-button", () => ({
  FilePickerButton: () => null,
}));
vi.mock("@/components/chat/attachment-preview-strip", () => ({
  AttachmentPreviewStrip: () => null,
}));
vi.mock("@/components/view-escape-hatch", () => ({
  ViewEscapeHatch: () => null,
}));

beforeEach(() => {
  send.mockClear();
  consumePendingChatQuery.mockReset();
  chatState.messages = [];
});

afterEach(() => {
  cleanup();
});

describe("ChatView pending-query auto-send", () => {
  it("sends the pending query exactly once on mount when one is waiting", () => {
    consumePendingChatQuery.mockReturnValue("what's your strongest project?");

    render(<ChatView />);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("what's your strongest project?", []);
  });

  it("does not call send when there is no pending query", () => {
    consumePendingChatQuery.mockReturnValue(null);

    render(<ChatView />);

    expect(send).not.toHaveBeenCalled();
  });
});

describe("ChatView AI disclosure (a neutral cue that still shows on phones)", () => {
  beforeEach(() => consumePendingChatQuery.mockReturnValue(null));

  // Below `sm` the header label is sr-only, so the header alone leaves a phone with an icon
  // and no text. A bare "AI" beside it was tried and made "Back to Classic" wrap at 390px, so
  // the visible cue lives in the intro and in the caption under the composer instead.
  it("says in the intro, in words a phone shows, that the visitor is talking to an AI assistant", () => {
    render(<ChatView />);
    const intro = screen.getByText(/I'm an AI assistant grounded in real projects/);
    // happy-dom cannot evaluate Tailwind, so "a phone shows it" is: no hiding class or
    // aria-hidden on the way up (the Playwright spec checks the real rendering).
    expect(hiddenBy(intro)).toBeNull();
  });

  it("captions the composer with the shared AI line on every viewport", () => {
    render(<ChatView />);
    expect(hiddenBy(screen.getByText(AI_CAPTION))).toBeNull();
  });

  it("keeps the caption once the conversation has started, when the intro is gone", () => {
    chatState.messages = [
      { role: "user", content: "What did you build?" },
      { role: "assistant", content: "A few things." },
    ];
    render(<ChatView />);
    expect(screen.queryByText(/I'm an AI assistant grounded in real projects/)).toBeNull();
    const caption = screen.getByText(AI_CAPTION);
    expect(hiddenBy(caption)).toBeNull();
  });

  it("leaves the header label as it was: visible from sm up, screen-reader-only below", () => {
    render(<ChatView />);
    const classes = screen.getAllByText("AI Concierge").map((el) => el.className);
    expect(classes).toContain("hidden sm:inline");
    expect(classes).toContain("sr-only sm:hidden");
    // No extra visible text beside the icon: it would push the Back link onto two lines.
    expect(screen.queryByText("AI")).toBeNull();
  });

  it("adds nothing to the header badge beyond the icon and its two label spans", () => {
    render(<ChatView />);
    const badge = screen.getAllByText("AI Concierge")[0].parentElement!;
    expect(
      Array.from(badge.children).map((child) => child.tagName.toLowerCase()),
    ).toEqual(["svg", "span", "span"]);
  });

  it("names no model, vendor or provider in the intro or the caption", () => {
    render(<ChatView />);
    const text = [
      screen.getByText(/I'm an AI assistant grounded in real projects/).textContent,
      screen.getByText(AI_CAPTION).textContent,
    ].join(" ");
    expect(text).not.toMatch(NAMES_A_MODEL_OR_VENDOR);
  });
});
