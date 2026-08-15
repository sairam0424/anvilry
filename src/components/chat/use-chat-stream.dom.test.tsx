import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat, type ChatMessage } from "./use-chat";
import {
  TRACE_DELIMITER,
  THINKING_SENTINEL,
  THINKING_END,
} from "@/lib/llm-trace";

/**
 * Loop-level coverage for the streaming read loop in useChat.
 *
 * The pre-existing use-chat.test.ts only exercises the PURE parsing helpers — it never
 * drives the actual `for(;;) { reader.read() }` loop, so the loop had no coverage at all.
 * These tests mock a real ReadableStream and run the genuine loop.
 *
 * Two environment facts shape how these tests are written; both were measured, not assumed:
 *
 *  1. Chunks must arrive on SEPARATE MACROTASKS to be realistic. React batches state
 *     updates within one task, so enqueueing every chunk synchronously makes batching look
 *     like coalescing (measured: 60 synchronous writes => 1 flush, 60 macrotask-spaced
 *     writes => 60 flushes). Real network streaming is the spaced case, so `streamOf`
 *     awaits a timer between chunks.
 *
 *  2. happy-dom's requestAnimationFrame fires at ~0.2ms, not the browser's ~16ms (measured).
 *     Left alone it behaves like setTimeout(0) and would never batch spaced chunks, so the
 *     coalescing test stubs rAF with a realistic frame interval. Production uses the real one.
 */

const FRAME_MS = 16;

/** Replace rAF with a browser-like ~16ms frame clock. Returns a restore function. */
function stubRealisticRaf() {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
    const handle = ++id;
    timers.set(
      handle,
      setTimeout(() => {
        timers.delete(handle);
        cb(Date.now());
      }, FRAME_MS),
    );
    return handle;
  });
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    const t = timers.get(handle);
    if (t) {
      clearTimeout(t);
      timers.delete(handle);
    }
  });
}

/**
 * A Response whose body yields `chunks`, one per macrotask, then closes.
 * `pull` is invoked per read, and the awaited timer forces each chunk onto its own task —
 * matching how bytes actually arrive over the network.
 */
function streamOf(chunks: string[], gapMs = 1): Response {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      async pull(c) {
        if (i >= chunks.length) {
          c.close();
          return;
        }
        await new Promise((r) => setTimeout(r, gapMs));
        c.enqueue(enc.encode(chunks[i++]));
      },
    }),
  } as unknown as Response;
}

/**
 * A Response that yields `chunks` then stays open until `signal` aborts, at which point the
 * stream errors with AbortError — the behaviour real `fetch` gives an aborted request. A
 * plain ReadableStream is NOT wired to the fetch signal, so without this an abort test can
 * never reject `reader.read()`.
 */
function abortableStreamOf(chunks: string[], signal: AbortSignal): Response {
  const enc = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        signal.addEventListener("abort", () => {
          try {
            c.error(new DOMException("Aborted", "AbortError"));
          } catch {
            /* already closed */
          }
        });
      },
      async pull(c) {
        if (i >= chunks.length) {
          // Stay open: never close, so only an abort can end this stream.
          await new Promise(() => {});
          return;
        }
        await new Promise((r) => setTimeout(r, 1));
        c.enqueue(enc.encode(chunks[i++]));
      },
    }),
  } as unknown as Response;
}

/** Mock fetch, handing the request's AbortSignal to the stream factory. */
function stubFetch(factory: (signal: AbortSignal) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(factory(init!.signal as AbortSignal)),
    ),
  );
}

/**
 * Render useChat while recording every DISTINCT assistant-content value React commits.
 * The length of that list is the number of user-visible paints — exactly what coalescing
 * is meant to reduce.
 */
function renderRecordingCommits() {
  const commits: string[] = [];
  const view = renderHook(() => {
    const chat = useChat();
    const last: ChatMessage | undefined =
      chat.messages[chat.messages.length - 1];
    if (
      last?.role === "assistant" &&
      (commits.length === 0 || commits[commits.length - 1] !== last.content)
    ) {
      commits.push(last.content);
    }
    return chat;
  });
  return { ...view, commits };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChat streaming loop — write coalescing", () => {
  it("collapses many macrotask-spaced chunks into far fewer commits", async () => {
    stubRealisticRaf();
    // 24 chunks ~1ms apart against a 16ms frame => many chunks per frame.
    // Un-coalesced this is ~24 commits (one setMessages per read).
    const words = Array.from({ length: 24 }, (_, i) => `w${i} `);
    stubFetch(() => streamOf(words));

    const { result, commits } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    expect(
      result.current.messages[result.current.messages.length - 1].content,
    ).toBe(words.join(""));

    // The real assertion: paints are decoupled from chunk count.
    const nonEmpty = commits.filter((c) => c !== "");
    expect(nonEmpty.length).toBeLessThanOrEqual(words.length / 2);
  });

  it("never drops the trailing chunk", async () => {
    stubRealisticRaf();
    // The tail is the dangerous case: a scheduler that only flushes on a frame would lose
    // whatever arrived after the final frame before the stream closed.
    const chunks = ["alpha ", "beta ", "gamma ", "TAIL_MUST_SURVIVE"];
    stubFetch(() => streamOf(chunks));

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    expect(
      result.current.messages[result.current.messages.length - 1].content,
    ).toBe(chunks.join(""));
  });

  it("still commits when requestAnimationFrame never fires (background tab)", async () => {
    // Browsers pause rAF in hidden tabs. Simulate that by making rAF a no-op: only the
    // BACKGROUND_FLUSH_MS safety timer (and the trailing flush) can make progress.
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    stubFetch(() => streamOf(["hidden ", "tab ", "still ", "works"]));

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    expect(
      result.current.messages[result.current.messages.length - 1].content,
    ).toBe("hidden tab still works");
  });

  it("strips the trace frame from visible text and surfaces model/fellBack", async () => {
    stubRealisticRaf();
    const trace = JSON.stringify({
      model: "claude-sonnet-4-6",
      fellBack: false,
    });
    stubFetch(() => streamOf(["Answer text.", TRACE_DELIMITER, trace]));

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.content).toBe("Answer text.");
    expect(last.content).not.toContain(TRACE_DELIMITER);
    expect(last.model).toBe("claude-sonnet-4-6");
    expect(last.fellBack).toBe(false);
  });
});

describe("useChat streaming loop — THINKING state machine survives coalescing", () => {
  it("clears isThinking and records a duration once THINKING_END arrives", async () => {
    stubRealisticRaf();
    stubFetch(() =>
      streamOf([
        THINKING_SENTINEL,
        "let me ",
        "consider ",
        "this",
        THINKING_END,
        "Final answer.",
      ]),
    );

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.isThinking).toBe(false);
    // Reasoning is captured and NOT leaked into the visible answer.
    expect(last.liveReasoning).toBe("let me consider this");
    expect(last.content).toBe("Final answer.");
    expect(last.content).not.toContain("consider");
    expect(typeof last.thinkingDuration).toBe("number");
  });

  it("keeps isThinking true while THINKING_END has not arrived", async () => {
    stubRealisticRaf();
    stubFetch(() => streamOf([THINKING_SENTINEL, "still ", "thinking"]));

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.isThinking).toBe(true);
    expect(last.liveReasoning).toBe("still thinking");
    expect(last.content).toBe("");
    expect(typeof last.thinkingStartedAt).toBe("number");
  });
});

describe("useChat streaming loop — abort", () => {
  it("preserves the partial answer and marks it [stopped]", async () => {
    stubRealisticRaf();
    stubFetch((signal) =>
      abortableStreamOf(["partial ", "answer ", "so far"], signal),
    );

    const { result } = renderRecordingCommits();
    // Kick off the stream without awaiting — it only ends on abort.
    act(() => {
      void result.current.send("q");
    });
    await waitFor(() =>
      expect(
        result.current.messages[result.current.messages.length - 1].content,
      ).toContain("partial"),
    );

    await act(async () => {
      result.current.stop();
    });

    await waitFor(() => {
      const last = result.current.messages[result.current.messages.length - 1];
      expect(last.content).toContain("partial");
      expect(last.content).toContain("[stopped]");
    });
    expect(result.current.status).toBe("idle");
  });
});

describe("useChat streaming loop — error paths unchanged", () => {
  it("surfaces the 503 not-configured message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, body: null } as Response),
    );

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });

    expect(result.current.status).toBe("error");
    expect(
      result.current.messages[result.current.messages.length - 1].content,
    ).toContain("isn't switched on yet");
  });

  it("surfaces the 429 rate-limit message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 429, body: null } as Response),
    );

    const { result } = renderRecordingCommits();
    await act(async () => {
      await result.current.send("q");
    });

    expect(result.current.status).toBe("error");
    expect(
      result.current.messages[result.current.messages.length - 1].content,
    ).toContain("a lot of questions");
  });
});
