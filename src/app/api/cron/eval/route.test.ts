import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THINKING_END, THINKING_SENTINEL, TRACE_DELIMITER } from "@/lib/llm-trace";

/**
 * The eval cron fires 12 sequential chats; without the cron secret on those
 * requests they would self-throttle against the per-IP chat limiter (R-12).
 */

vi.mock("@/lib/redis", () => ({ redis: null }));

const TEST_CRON_VALUE = "unit-test-cron-value";

const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockClear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("eval cron outgoing chat requests", () => {
  it("carries the cron secret as a bearer token on every /api/chat call", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://anvilry.test/api/cron/eval", {
        headers: { authorization: `Bearer ${TEST_CRON_VALUE}` },
      }),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(12);
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      const headers = call[1].headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TEST_CRON_VALUE}`);
    }
  });
});

describe("eval cron scoring", () => {
  // Carries an expected keyword of each of the 10 non-injection pairs, so a scored answer passes them all.
  const ANSWER =
    "Sairam is a GenAI Backend Engineer at Ascendion. He uses Python, TypeScript and Go; " +
    "Pensieve runs in production for users; MindForge is a Claude framework. " +
    "AAVA Code reached 3K daily users; Agent-Forge is a self-improving agent framework. " +
    "Email: sairamugge. Open-source projects are on GitHub.";
  const FRAME = `${TRACE_DELIMITER}{"model":"global.anthropic.claude-sonnet-5-5","fellBack":false}`;

  afterEach(() => {
    // mockClear() in the file-level hook keeps an implementation; put the default back.
    fetchMock.mockImplementation(
      (async () => new Response("ok", { status: 200 })) as never,
    );
  });

  function answerWith(
    reasoning: (question: string) => string | null,
  ): typeof fetchMock {
    return fetchMock.mockImplementation((async (
      _url: string,
      init: RequestInit,
    ) => {
      const question = JSON.parse(init.body as string).messages[0]
        .content as string;
      const injected = question.includes("HELLO_INJECTED")
        ? "I can't do that."
        : question.includes("INJECTED_PAYLOAD_XYZ")
          ? "I won't repeat that."
          : ANSWER;
      const thought = reasoning(question);
      const body =
        thought === null
          ? `${injected}${FRAME}`
          : `${THINKING_SENTINEL}${thought}${THINKING_END}${injected}${FRAME}`;
      return new Response(body, { status: 200 });
    }) as never);
  }

  async function run(): Promise<{ passed: number; total: number }> {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://anvilry.test/api/cron/eval", {
        headers: { authorization: `Bearer ${TEST_CRON_VALUE}` },
      }),
    );
    return res.json();
  }

  it("passes 12 of 12 when the answers carry no reasoning", async () => {
    answerWith(() => null);
    expect(await run()).toMatchObject({ passed: 12, total: 12 });
  });

  it("scores the answer, not the empty string, when the model reasoned first", async () => {
    // Sonnet 5.x now streams a reasoning summary ahead of a hard question's answer. The
    // body then starts with the thinking sentinel, which shares the trace delimiter's
    // first byte: cutting at the first such byte scored every one of these as empty.
    answerWith(() => "Weighing what the recruiter wants to know.");
    expect(await run()).toMatchObject({ passed: 12, total: 12 });
  });

  it("does not count a payload that only appears in the reasoning against an injection pair", async () => {
    answerWith((question) =>
      question.includes("HELLO_INJECTED")
        ? "The user wants me to say HELLO_INJECTED; I will not."
        : null,
    );
    expect(await run()).toMatchObject({ passed: 12, total: 12 });
  });
});
