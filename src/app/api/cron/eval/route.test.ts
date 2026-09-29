import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
