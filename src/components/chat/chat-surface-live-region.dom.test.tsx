import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { ChatView } from "./chat-view";
import { AskPortfolio } from "@/components/ask-portfolio";
import { ViewProvider } from "@/components/view-context";

/**
 * Regression guard for the aria-live SINGLE-ANNOUNCEMENT invariant across the WHOLE
 * composed chat surface — not just useChatA11y in isolation (use-chat-a11y.dom.test.tsx)
 * and not just ChatMessages fed synthetic props (chat-messages.dom.test.tsx).
 *
 * This session found and fixed TWO separate, real double-announce bugs, each invisible
 * from inside a single component:
 *   1. ask-portfolio.tsx — the transcript's `role="log"` implicitly defaults to
 *      `aria-live="polite"` per the ARIA spec, competing with useChatA11y's own
 *      announcer div (also aria-live="polite") one level up.
 *   2. chat-messages.tsx — an unrelated commit (#54) set `aria-live="polite"` directly
 *      on the scrollable transcript container, which itself WRAPS useChatA11y's
 *      announcer div — so every new message got announced twice: once by the
 *      container reacting to its own mutation, once by the deliberate announcer.
 *
 * Both fixes are additive `aria-live="off"` overrides on the transcript element. A test
 * that renders useChatA11y alone, or ChatMessages with hand-fed `messages`/`isStreaming`
 * props, never exercises the actual DOM nesting where the interaction happened. This
 * test instead renders the REAL top-level parents (ChatView — the full "AI Concierge"
 * view — and the AskPortfolio floating widget) end-to-end through a simulated streamed
 * answer via the shared useChat transport, and asserts the invariant against the whole
 * rendered tree at multiple points in the lifecycle.
 */

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

// ChatView's non-transcript controls need browser speech/media APIs this test doesn't
// exercise. Mocked away exactly like chat-view.dom.test.tsx — but unlike that file, we
// deliberately do NOT mock ChatMessages or use-chat: those own the transcript container
// and the real streaming lifecycle this test is pinning.
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

/** A Response whose body streams `chunks` as UTF-8, like /api/chat's plain-text stream. */
function streamingResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return { ok: true, body, status: 200 } as unknown as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The invariant itself: exactly one `aria-live="polite"` element anywhere in the
 * rendered tree — the dedicated sr-only announcer from useChatA11y — and any element
 * carrying an implicit-live-region role (role="log", used by both transcript
 * containers) must explicitly override the default with `aria-live="off"`. Silently
 * dropping that override is exactly how both historical bugs reopened this defect, so
 * this checks the override is present, not merely that nothing is currently "polite".
 */
function expectExactlyOneLiveAnnouncer(container: HTMLElement) {
  const politeRegions = container.querySelectorAll('[aria-live="polite"]');
  expect(politeRegions).toHaveLength(1);
  expect(politeRegions[0].className).toContain("sr-only");

  container.querySelectorAll('[role="log"]').forEach((el) => {
    expect(el.getAttribute("aria-live")).toBe("off");
  });
}

describe("Chat surface — single aria-live announcer invariant (composed tree)", () => {
  it("ChatView: exactly one live region survives a full streamed-answer lifecycle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamingResponse(["Building agent ", "backends at Ascendion."]),
      ),
    );

    const { container } = render(
      <ViewProvider>
        <ChatView />
      </ViewProvider>,
    );

    fireEvent.change(screen.getByLabelText("Ask a question about Sairam"), {
      target: { value: "What do you build?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    // Mid-stream, before the answer settles: the user message is in, the announcer is
    // debouncing toward "Answering…". The double-announce bugs fired on every appended
    // message, not only the final one, so check the invariant here too.
    await waitFor(() =>
      expect(screen.getByText("What do you build?")).toBeTruthy(),
    );
    expectExactlyOneLiveAnnouncer(container);

    // Let the stream settle for real (real timers — matches production debounce).
    // getAllByText, not getByText: by design, this exact text legitimately appears
    // TWICE once settled (the visible chat bubble AND the sr-only announcer's copy
    // of the same answer) — that duplication is the feature working correctly, not
    // a violation. getByText throws on >1 match; this assertion only needs "has the
    // answer text landed somewhere in the tree yet."
    await waitFor(
      () =>
        expect(
          within(container).getAllByText(
            "Building agent backends at Ascendion.",
          ).length,
        ).toBeGreaterThan(0),
      { timeout: 3000 },
    );

    // Give useChatA11y's ~150ms settle-announce timer a chance to actually fire, then
    // confirm the sr-only announcer is the channel that ends up carrying the answer.
    await waitFor(
      () => {
        const announcer = container.querySelector('[aria-live="polite"]');
        expect(announcer?.textContent).toBe(
          "Building agent backends at Ascendion.",
        );
      },
      { timeout: 1000 },
    );

    expectExactlyOneLiveAnnouncer(container);
  });

  it("AskPortfolio widget: exactly one live region survives a full streamed-answer lifecycle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(["Hello ", "from ", "the corpus."])),
    );

    const { container } = render(
      <ViewProvider>
        <AskPortfolio />
      </ViewProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ask my portfolio" }));
    fireEvent.change(screen.getByLabelText("Ask a question about Sairam"), {
      target: { value: "What did you build?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText("What did you build?")).toBeTruthy(),
    );
    expectExactlyOneLiveAnnouncer(container);

    // getAllByText, not getByText — same reasoning as the ChatView test above:
    // if the sr-only announcer happens to be nested inside the transcript's
    // role="log" element, this exact text can legitimately match twice.
    await waitFor(
      () => {
        const transcript = screen.getByRole("log", { name: "Chat transcript" });
        expect(
          within(transcript).getAllByText("Hello from the corpus.").length,
        ).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    await waitFor(
      () => {
        const announcer = container.querySelector('[aria-live="polite"]');
        expect(announcer?.textContent).toBe("Hello from the corpus.");
      },
      { timeout: 1000 },
    );

    expectExactlyOneLiveAnnouncer(container);
  });
});
