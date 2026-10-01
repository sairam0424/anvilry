import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
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
    cancel: vi.fn(),
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
function renderMessages(messages: ChatMessage[], isStreaming = false) {
  return render(
    <TooltipProvider>
      <ViewProvider>
        <ChatMessages messages={messages} isStreaming={isStreaming} />
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
 * sit under every answer (2026-09-30), and asked that no visitor-facing text name
 * the model or provider. The server still sends the model in the trace frame and
 * the hook still stores it on the message; only the UI is gone, including the
 * "primary unavailable" prefix that shared its <p> and the model family that was
 * in the streaming reasoning block's accessible name.
 */
describe("ChatMessages — no model or provider attribution in the transcript", () => {
  const answered = (fellBack: boolean): ChatMessage[] => [
    { role: "user", content: "What stack do you use?" },
    {
      role: "assistant",
      content: "TypeScript, mostly.",
      model: "us.anthropic.claude-sonnet-4-6",
      fellBack,
    },
  ];
  // "Anthropic" is the other provider behind the LLM_PROVIDER toggle.
  const LEAKS = [
    "Answered by",
    "Claude",
    "Sonnet",
    "Haiku",
    "Opus",
    "Bedrock",
    "Anthropic",
    "primary unavailable",
  ];
  // Read the serialised DOM, not textContent: a title=, aria-label or alt that
  // names the model is visible to hover users and screen readers but has no text node.
  const expectNoLeaks = (container: HTMLElement) => {
    const html = container.innerHTML;
    for (const leaked of LEAKS) expect(html).not.toContain(leaked);
  };

  it.each([false, true])(
    "prints neither the model, the provider nor a fallback note (fellBack=%s)",
    (fellBack) => {
      const { container } = renderMessages(answered(fellBack));
      // Positive control: the transcript rendered, so the absences are not an empty render.
      expect(container.textContent).toContain("What stack do you use?");
      expectNoLeaks(container);
    },
  );

  it("names no model in the streaming reasoning block either", () => {
    const { container } = renderMessages(
      [
        { role: "user", content: "What stack do you use?" },
        {
          role: "assistant",
          content: "",
          isThinking: true,
          liveReasoning: "weighing options",
        },
      ],
      true,
    );
    // Positive control: the live-reasoning <pre> is what carries the accessible name.
    expect(container.textContent).toContain("weighing options");
    expectNoLeaks(container);
  });

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
    expect(container.textContent).toContain("Listen");
    expectNoLeaks(container);
  });
});

describe("ChatMessages — the reasoning of a replayed FAQ-cache hit", () => {
  const replayed: ChatMessage[] = [
    { role: "user", content: "What stack do you use?" },
    {
      role: "assistant",
      content: "TypeScript, mostly.",
      liveReasoning:
        "The user asks about my stack, so I'll name TypeScript first.",
      isThinking: false,
      // A replay arrives in one chunk: the chat hook reports a zero-second thought.
      thinkingDuration: 0,
    },
  ];

  it("offers a collapsed 'Thought for a moment' toggle directly above the answer bubble", () => {
    const { getByRole, queryByText } = renderMessages(replayed);
    const toggle = getByRole("button", { name: /Thought for a moment/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(queryByText(/so I'll name TypeScript first/)).toBeNull();
    // The answer text is a lazily loaded markdown segment (and the sr-only announcer repeats it
    // after a debounce), so this checks the block that follows the toggle instead of waiting for either.
    const next = toggle.closest("div.mb-2")?.nextElementSibling;
    expect(next?.className).toContain("rounded-2xl");
  });

  it("opens to the stored reasoning, as plain text", () => {
    const { getByRole, getByText } = renderMessages(replayed);
    fireEvent.click(getByRole("button", { name: /Thought for a moment/ }));
    const pre = getByText(/so I'll name TypeScript first/);
    expect(pre.tagName).toBe("PRE");
  });

  it("names the real duration when there is one", () => {
    const { getByRole } = renderMessages([
      replayed[0],
      { ...replayed[1], thinkingDuration: 4 },
    ]);
    expect(getByRole("button", { name: /Thought for 4s/ })).not.toBeNull();
  });
});
