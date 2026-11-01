import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "../../cli/lib/constants.mjs";
import { bytesResponder, redirectResponder } from "./support/mock-api";
import { setupProcessHarness } from "./support/process-harness";
import { runCli } from "./support/run-cli";

/**
 * The real binary against servers that misbehave: a redirect to another origin (the CLI must not
 * go there, and must not send the batch body there), a body that is not valid UTF-8 (--raw must
 * hand it over byte for byte) and a body over the size limit (exit 2, nothing printed).
 */

const { mockApi } = setupProcessHarness();

describe("a redirect to another origin", () => {
  it.each([302, 307, 308])(
    "is reported and not followed (%i), so the other origin sees nothing",
    async (status) => {
      const elsewhere = await mockApi();
      const api = await mockApi(
        redirectResponder(`${elsewhere.baseUrl}/landed/api/v1/profile`, status),
      );
      const result = await runCli(["profile", "--base-url", api.baseUrl]);

      expect(result.code).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`redirect (HTTP ${status})`);
      expect(result.stderr).toContain(`${elsewhere.baseUrl}/landed/api/v1/profile`);
      expect(api.received()).toHaveLength(1);
      expect(elsewhere.received()).toHaveLength(0);
    },
  );

  it("does not send the batch body to the other origin after a 307", async () => {
    const elsewhere = await mockApi();
    const api = await mockApi(redirectResponder(`${elsewhere.baseUrl}/batch`, 307));
    const result = await runCli([
      "batch",
      "/api/v1/profile",
      "--base-url",
      api.baseUrl,
    ]);

    expect(result.code).toBe(2);
    expect(api.received().map((request) => request.method)).toEqual(["POST"]);
    expect(elsewhere.received()).toHaveLength(0);
  });
});

describe("a body that is not plain UTF-8", () => {
  it("is printed by --raw byte for byte", async () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('{"a":"'),
      Buffer.from([0xff, 0xfe, 0x00, 0x80]),
      Buffer.from('"}'),
    ]);
    const api = await mockApi(bytesResponder(bytes));
    const result = await runCli(["profile", "--raw", "--base-url", api.baseUrl]);

    expect(result.code).toBe(0);
    expect(Buffer.compare(result.stdoutBytes, bytes)).toBe(0);
  });
});

describe("a body over the size limit", () => {
  it("exits 2 and prints nothing", async () => {
    const api = await mockApi(bytesResponder(Buffer.alloc(MAX_BODY_BYTES + 1, 0x61)));
    const result = await runCli(["profile", "--base-url", api.baseUrl]);

    expect(result.code).toBe(2);
    expect(result.stdoutBytes.byteLength).toBe(0);
    expect(result.stderr).toContain("response_too_large (HTTP 200)");
  });

  it("exits 2 with --raw too", async () => {
    const api = await mockApi(bytesResponder(Buffer.alloc(MAX_BODY_BYTES + 1, 0x61)));
    const result = await runCli(["profile", "--raw", "--base-url", api.baseUrl]);

    expect(result.code).toBe(2);
    expect(result.stdoutBytes.byteLength).toBe(0);
    expect(result.stderr).toContain("response_too_large");
  });
});

describe("a body that is JSON but cannot be printed", () => {
  const deep = (levels: number) => "[".repeat(levels) + "]".repeat(levels);

  it("exits 2 with one line on standard error and no stack trace, not 1 with a crash", async () => {
    const body = Buffer.from(deep(100_000));
    const api = await mockApi(bytesResponder(body));
    const result = await runCli(["profile", "--base-url", api.baseUrl]);

    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/^anvilry: bad_response \(HTTP 200\): Could not print the response \(/);
    expect(result.stderr.trimEnd().split("\n")).toHaveLength(1);
    expect(result.stderr).not.toMatch(/RangeError|\n\s+at /);
  });

  it("prints the same body byte for byte with --raw", async () => {
    const body = Buffer.from(deep(100_000));
    const api = await mockApi(bytesResponder(body));
    const result = await runCli(["profile", "--raw", "--base-url", api.baseUrl]);

    expect(result.code).toBe(0);
    expect(Buffer.compare(result.stdoutBytes, body)).toBe(0);
  });

  it("refuses the small-but-huge-when-indented body quickly instead of building gigabytes", async () => {
    const body = Buffer.from(
      `${"[".repeat(900)}${"1,".repeat(100_000)}1${"]".repeat(900)}`,
    );
    const api = await mockApi(bytesResponder(body));
    const result = await runCli(["profile", "--base-url", api.baseUrl]);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("indented form would be larger than 64 MiB");
  });
});
