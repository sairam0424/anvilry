import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AskPortfolio } from "./ask-portfolio";
import { ViewProvider } from "@/components/view-context";

// ViewProvider mounts ViewQuerySync, which reads useSearchParams() — null outside a
// Next router. Provide an empty params object so the provider mounts as bare "/".
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
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
    await waitFor(() => expect(screen.getByText("Hello from the corpus.")).toBeTruthy());

    // It POSTed to /api/chat — the one shared seam, not a widget-private endpoint.
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith("/api/chat", expect.objectContaining({ method: "POST" }));
  });

  it("surfaces the 503 not-configured message gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, body: null }) as unknown as Response),
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
