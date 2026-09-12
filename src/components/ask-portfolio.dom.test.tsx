import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { AskPortfolio } from "./ask-portfolio";
import { ViewProvider } from "@/components/view-context";

// ViewProvider mounts ViewQuerySync (reads useSearchParams() — null outside a Next
// router) and ViewRouterBridge (reads useRouter()/usePathname(), so setViewInternal
// can navigate cross-route). Stub all three so the provider mounts as bare "/".
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

/**
 * Phase 0 unification contract: the floating widget streams through the SHARED useChat
 * transport (not its old hand-rolled fetch loop). We stub a streaming fetch (matching
 * the repo's vi.stubGlobal idiom) and assert a typed question yields the streamed
 * assistant answer in the panel — proving the widget rides the same /api/chat
 * ReadableStream path the full Chat view uses. happy-dom has no real streaming fetch,
 * so the mock returns a ReadableStream body the transport reads to completion.
 */

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

const renderWidget = () =>
  render(
    <ViewProvider>
      <AskPortfolio />
    </ViewProvider>,
  );

describe("AskPortfolio widget (unified onto useChat)", () => {
  it("streams an assistant answer through the shared transport", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(["Hello ", "from ", "the corpus."])),
    );

    renderWidget();
    // Open the panel.
    fireEvent.click(screen.getByRole("button", { name: "Ask my portfolio" }));

    const input = screen.getByLabelText("Ask a question about Sairam");
    fireEvent.change(input, { target: { value: "What did you build?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    // The user message echoes immediately.
    expect(screen.getByText("What did you build?")).toBeTruthy();
    // The streamed assistant answer settles via the shared useChat reader loop.
    // Scoped to the transcript log: once settled, useChatA11y also mirrors the
    // same final text into the sr-only aria-live announcer (announce-on-settle,
    // see use-chat-a11y.ts), so an unscoped query matches both and throws.
    // Timeout above the default 1000ms: the commit is coalesced onto
    // requestAnimationFrame with a 250ms safety-timer fallback
    // (BACKGROUND_FLUSH_MS in use-chat.ts) for when rAF doesn't fire — under
    // happy-dom + CI load that fallback can occasionally miss the default window.
    const transcript = screen.getByRole("log", { name: "Chat transcript" });
    await waitFor(
      () =>
        expect(
          within(transcript).getByText("Hello from the corpus."),
        ).toBeTruthy(),
      { timeout: 3000 },
    );

    // It POSTed to /api/chat — the one shared seam, not a widget-private endpoint.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the 503 not-configured message gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({ ok: false, status: 503, body: null }) as unknown as Response,
      ),
    );

    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Ask my portfolio" }));
    fireEvent.change(screen.getByLabelText("Ask a question about Sairam"), {
      target: { value: "hi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(screen.getByText(/chat isn't switched on yet/i)).toBeTruthy(),
    );
  });
});
