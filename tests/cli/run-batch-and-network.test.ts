import { describe, expect, it } from "vitest";
import { run } from "../../cli/lib/run.mjs";
import { json, runInProcess, type Respond } from "./support/in-process";

/** Batch outcomes and the "no answer" failures, run in-process with a scripted fetch. */

describe("batch", () => {
  const answer = (statuses: number[]) =>
    json({
      responses: statuses.map((status, index) => ({
        id: String(index + 1),
        status,
        body:
          status < 400
            ? { ok: true }
            : { error: "gone", code: "not_found", status },
      })),
    });

  it("exits 0 when every operation succeeded", async () => {
    const result = await runInProcess(
      ["batch", "/api/v1/profile", "/api/v1/work"],
      () => answer([200, 200]),
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).responses).toHaveLength(2);
    expect(result.stderr).toBe("");
  });

  it("prints the full body and exits 2 when any operation failed", async () => {
    const result = await runInProcess(
      ["batch", "/api/v1/profile", "/api/v1/x", "/api/v1/y"],
      () => answer([200, 404, 500]),
    );
    expect(result.code).toBe(2);
    expect(
      JSON.parse(result.stdout).responses.map(
        (r: { status: number }) => r.status,
      ),
    ).toEqual([200, 404, 500]);
    expect(result.stderr).toBe(
      "anvilry: 2 of 3 batch operations failed. Their status and body are in the output.\n",
    );
  });

  it("applies the same exit code with --raw", async () => {
    const result = await runInProcess(
      ["batch", "/api/v1/a", "/api/v1/b", "--raw"],
      () => answer([404, 200]),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("1 of 2 batch operations failed");
  });

  it("does not judge a body that has no responses array", async () => {
    const result = await runInProcess(["batch", "/api/v1/a"], () =>
      json({ odd: true }),
    );
    expect(result.code).toBe(0);
  });

  it("reports a batch refused as a whole as an ordinary API error", async () => {
    const result = await runInProcess(["batch", "/api/v1/a"], () =>
      json(
        {
          error: "A batch carries at most 25 operations.",
          code: "invalid_request",
          status: 400,
        },
        400,
      ),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("invalid_request (HTTP 400)");
  });
});

describe("no answer", () => {
  it("exits 3 when the host cannot be reached, naming the reason", async () => {
    const result = await runInProcess(["status"], () => {
      throw new TypeError("fetch failed", {
        cause: Object.assign(new Error("connect refused"), {
          code: "ECONNREFUSED",
        }),
      });
    });
    expect(result.code).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "anvilry: Could not get an answer from https://anvilry.vercel.app/api/v1: ECONNREFUSED connect refused\n",
    );
  });

  it("uses the cause alone when it has no code, and the error itself when it has no cause", async () => {
    const noCode = await runInProcess(["status"], () => {
      throw new TypeError("fetch failed", {
        cause: new Error("socket hang up"),
      });
    });
    expect(noCode.stderr).toContain(": socket hang up");
    const noCause = await runInProcess(["status"], () => {
      throw new Error("boom");
    });
    expect(noCause.code).toBe(3);
    expect(noCause.stderr).toContain(": boom");
  });

  // Deterministic however slow the machine is: everything the fake does before the deadline is
  // synchronous or a microtask, and the deadline is a later timer, so it can only fire while the
  // fake is waiting for the abort.
  const DEADLINE_MS = 200;

  it("exits 3 with a timeout message when the deadline passes", async () => {
    const hang: Respond = ({ init }) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const result = await runInProcess(
      ["status", "--timeout", String(DEADLINE_MS)],
      hang,
    );
    expect(result.code).toBe(3);
    expect(result.stderr).toBe(
      `anvilry: The request to https://anvilry.vercel.app/api/v1 timed out after ${DEADLINE_MS} ms.\n`,
    );
  });

  it("applies the deadline to reading the body, not only to the headers", async () => {
    // The headers arrive at once; the body never does, until the request is aborted.
    const stalledBody: Respond = ({ init }) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init.signal?.addEventListener("abort", () =>
              controller.error(new DOMException("aborted", "AbortError")),
            );
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    const result = await runInProcess(
      ["status", "--timeout", String(DEADLINE_MS)],
      stalledBody,
    );
    expect(result.code).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(`timed out after ${DEADLINE_MS} ms`);
  });

  it("does not hide a failure that is not a usage, API or network problem", async () => {
    const failingStdout = run(["version"], {
      env: {},
      stdout: () => {
        throw new Error("disk on fire");
      },
      stderr: () => undefined,
      fetch: (() => {
        throw new Error("fetch must not be called");
      }) as unknown as typeof fetch,
    });
    await expect(failingStdout).rejects.toThrow("disk on fire");
  });
});
