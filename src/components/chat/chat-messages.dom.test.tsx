import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ChatMessages } from "./chat-messages";
import { ViewProvider } from "@/components/view-context";
import type { ChatMessage } from "@/components/chat/use-chat";

/**
 * Regression guard for the accidental double-announce bug found while
 * verifying the develop->main promotion live: an unrelated commit (#54)
 * put aria-live="polite" directly on the scrollable transcript container,
 * which wraps both useChatA11y's deliberate single-channel announcer AND
 * the full message list — so every new message got announced twice. Same
 * bug class already fixed once in ask-portfolio.tsx (role="log" implicit
 * aria-live), but this is a separate component with its own separate cause.
 */

// ViewProvider mounts ViewRouterBridge (useRouter()/usePathname()) and ViewQuerySync
// (useSearchParams()), both of which throw outside a real Next router — stub all
// three so the provider mounts as bare "/", matching ask-portfolio.dom.test.tsx.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/components/chat/use-speech-synthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: false,
    isSpeaking: false,
    speak: vi.fn(),
    stop: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

function renderMessages(messages: ChatMessage[]) {
  return render(
    <ViewProvider>
      <ChatMessages messages={messages} isStreaming={false} />
    </ViewProvider>,
  );
}

describe("ChatMessages — transcript container is not a live region", () => {
  it("sets aria-live=off on the scrollable transcript container", () => {
    const { container } = renderMessages([
      { role: "user", content: "What stack do you use?" },
      { role: "assistant", content: "TypeScript, mostly." },
    ]);

    const scrollContainer = container.querySelector(
      "[tabindex='-1'].overflow-y-auto",
    );
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer?.getAttribute("aria-live")).toBe("off");
  });

  it("keeps exactly one aria-live='polite' region on the page — the dedicated announcer", () => {
    const { container } = renderMessages([
      { role: "user", content: "What stack do you use?" },
      { role: "assistant", content: "TypeScript, mostly." },
    ]);

    const politeRegions = container.querySelectorAll('[aria-live="polite"]');
    expect(politeRegions).toHaveLength(1);
    expect(politeRegions[0].className).toContain("sr-only");
  });
});
