import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ChatView } from "./chat-view";

const { send, consumePendingChatQuery } = vi.hoisted(() => ({
  send: vi.fn(),
  consumePendingChatQuery: vi.fn(),
}));

vi.mock("@/components/chat/use-chat", () => ({
  useChat: () => ({
    messages: [],
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
