import { describe, expect, it, vi } from "vitest";
import { BATCH_MAX_RESPONSE_BYTES, BATCH_PATH } from "@/lib/api-policy";
import { SITE_URL } from "@/lib/site-url";
import { expectApiError } from "../v1-test-support";

/**
 * The answer cap at the route, with the batch's own runner replaced by one that returns a constructed
 * oversized result, so the 413 is exercised whatever the real routes happen to weigh. The real
 * routes can no longer produce an answer near the cap (an operation may appear once; see
 * batch-run.test.ts for the measured worst case), so only a stub can reach it.
 */

const HALF_PLUS = Math.floor(BATCH_MAX_RESPONSE_BYTES * 0.6);

const { runBatch } = vi.hoisted(() => ({ runBatch: vi.fn() }));

vi.mock("@/lib/batch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/batch")>()),
  runBatch,
}));

const route = await import("./route");

const post = (count: number) =>
  route.POST(
    new Request(`${SITE_URL}${BATCH_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requests: Array.from({ length: count }, (_, i) => ({ id: `r${i}`, path: `/api/v1/search?q=${"a".repeat(i + 1)}` })),
      }),
    }),
  );

/** Results as big as the runner is told to make them, one per item. */
const returning = (bytesPerItem: number) =>
  runBatch.mockImplementation(async (items: { id: string }[]) =>
    items.map(({ id }) => ({ id, status: 200, body: { text: "x".repeat(bytesPerItem) } })),
  );

describe("POST /api/v1/batch with an answer over the cap", () => {
  it("refuses the whole answer with a 413 payload_too_large and sends none of the results", async () => {
    returning(HALF_PLUS);
    const res = await post(2);
    const body = await expectApiError(res, 413, "payload_too_large");
    expect(body.error).toContain(String(BATCH_MAX_RESPONSE_BYTES));
    expect(body.hint).toContain("fewer or smaller operations");
    expect(JSON.stringify(body)).not.toContain("xxxx");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(runBatch).toHaveBeenCalledTimes(1);
  });

  it("sends the same kind of answer whole when it is under the cap", async () => {
    runBatch.mockClear();
    returning(HALF_PLUS);
    const res = await post(1);
    expect(res.status).toBe(200);
    expect((await res.json()).responses).toHaveLength(1);
  });
});
