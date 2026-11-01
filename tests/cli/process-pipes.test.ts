import { describe, expect, it } from "vitest";
import {
  gatedResponder,
  portfolioResponder,
  bytesResponder,
} from "./support/mock-api";
import { setupProcessHarness } from "./support/process-harness";
import { startCli } from "./support/run-cli";

/**
 * `anvilry openapi | head -1` closes the pipe while the CLI is still writing. That is the reader's
 * choice, not a failure: no stack trace, and exit code 0. Both tests close the pipe at a point
 * ordered by events (the first chunk arrived, or the request is parked at the server), never by time.
 */

const { mockApi } = setupProcessHarness();

/** Pretty-printed this is several megabytes, far more than a pipe buffer holds. */
const BIG_BODY = JSON.stringify({
  items: Array.from({ length: 60_000 }, (_, index) => ({
    index,
    text: "padding padding padding",
  })),
});

describe("a reader that stops reading", () => {
  it("is not an error when it closes standard output early", async () => {
    const api = await mockApi(bytesResponder(Buffer.from(BIG_BODY)));
    const { child, done } = startCli(["profile", "--base-url", api.baseUrl]);
    child.stdout?.once("data", () => child.stdout?.destroy());

    const result = await done;
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });

  it("is not an error when it closes standard error before the CLI reports an error", async () => {
    const gate = gatedResponder(portfolioResponder());
    const api = await mockApi(gate.respond);
    const { child, done } = startCli([
      "projects",
      "nope",
      "--base-url",
      api.baseUrl,
    ]);

    // The CLI has sent its request and has nothing to print yet; close its standard error now,
    // then let the server answer with a 404 whose message the CLI will try to print there.
    await Promise.race([
      gate.arrived,
      done.then(() => {
        throw new Error("the CLI exited before it sent a request");
      }),
    ]);
    child.stderr?.destroy();
    gate.open();

    const result = await done;
    expect(result.stdout).toBe("");
    expect(result.code).toBe(0);
  });
});
