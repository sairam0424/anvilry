import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ChatMessages } from "./chat-messages";
import { ViewProvider } from "@/components/view-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/components/chat/use-chat";
import {
  DEFAULTS,
  STORAGE_KEY,
  __resetVoiceSettingsForTest,
} from "@/lib/voice-settings-context";

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

// Mutable so one test can turn speech support on; reset in afterEach.
const tts = vi.hoisted(() => ({ supported: false }));

vi.mock("@/components/chat/use-speech-synthesis", () => ({
  useSpeechSynthesis: () => ({
    supported: tts.supported,
    isSpeaking: false,
    speak: vi.fn(),
    stop: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  tts.supported = false;
  window.localStorage.clear();
  __resetVoiceSettingsForTest();
});

// Production always has a TooltipProvider ancestor (src/components/providers.tsx);
// the read-aloud button's Tooltip throws without one.
function renderMessages(messages: ChatMessage[]) {
  return render(
    <TooltipProvider>
      <ViewProvider>
        <ChatMessages messages={messages} isStreaming={false} />
      </ViewProvider>
    </TooltipProvider>,
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

/**
 * The owner removed the "Answered by Claude Sonnet · Bedrock" line that used to
 * sit under every answer (2026-09-30). The server still sends the model in the
 * trace frame and the hook still stores it on the message; only the UI text is
 * gone, including the "primary unavailable" prefix that shared its <p>.
 */
describe("ChatMessages — no model or provider attribution under an answer", () => {
  const answered = (fellBack: boolean): ChatMessage[] => [
    { role: "user", content: "What stack do you use?" },
    {
      role: "assistant",
      content: "TypeScript, mostly.",
      model: "us.anthropic.claude-sonnet-4-6",
      fellBack,
    },
  ];
  const LEAKS = [
    "Answered by",
    "Claude",
    "Sonnet",
    "Haiku",
    "Opus",
    "Bedrock",
    "primary unavailable",
  ];

  it.each([false, true])(
    "prints neither the model, the provider nor a fallback note (fellBack=%s)",
    (fellBack) => {
      const { container } = renderMessages(answered(fellBack));
      const text = container.textContent ?? "";
      for (const leaked of LEAKS) expect(text).not.toContain(leaked);
    },
  );

  it("still offers read-aloud when speech is opted in and supported", () => {
    tts.supported = true;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULTS, ttsEnabled: true }),
    );
    const { container, getByRole } = renderMessages(answered(false));

    expect(
      getByRole("button", { name: "Read this answer aloud" }),
    ).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).toContain("Listen");
    for (const leaked of LEAKS) expect(text).not.toContain(leaked);
  });
});
