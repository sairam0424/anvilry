import { describe, expect, it, vi } from "vitest";
import { escapeForTerminal, escapeJsonOutput } from "../../cli/lib/escape.mjs";
import { MAX_BODY_BYTES, MAX_PRETTY_CHARS } from "../../cli/lib/constants.mjs";
import { json, runInProcess } from "./support/in-process";

/**
 * What the CLI does with a server it has no reason to trust (--base-url can point anywhere): it
 * keeps terminal control sequences out of what it prints, never follows a redirect, prints --raw
 * bytes untouched, and refuses a body that is too large. Run in-process with a scripted fetch.
 */

const MIB = 1024 * 1024;
const ESC = "\u001b";
const NASTY = `ok ${ESC}[31mred ${"\u009b"}31m ${"\u202e"}rtl ${"\u200b"}zw ${"\u2066"}iso ${"\u007f"}del ${"\u{e0041}"}tag é ✓ 日本`;

describe("escaping what the server sent", () => {
  it("writes control and format characters as \\uXXXX escapes", () => {
    expect(escapeForTerminal(`a${ESC}b\u0007c\u009bd\u202ee\u200bf\n`)).toBe(
      "a\\u001bb\\u0007c\\u009bd\\u202ee\\u200bf\\u000a",
    );
    expect(escapeForTerminal("plain é ✓ 日本 😀")).toBe("plain é ✓ 日本 😀");
  });

  it("writes a character outside the BMP as a surrogate pair", () => {
    expect(escapeForTerminal("\u{e0041}")).toBe("\\udb40\\udc41");
  });

  it("leaves the structure of pretty-printed JSON alone and escapes only what the strings hold", () => {
    const pretty = `{\n  "s": "x\u009by\u202ez"\n}\n`;
    expect(escapeJsonOutput(pretty)).toBe(`{\n  "s": "x\\u009by\\u202ez"\n}\n`);
  });

  it("prints C1, bidi and format characters as escapes in the default JSON output, and it still parses to the same value", async () => {
    const result = await runInProcess(["profile"], () => json({ s: NASTY }));
    expect(result.code).toBe(0);
    for (const escaped of [
      "\\u001b",
      "\\u009b",
      "\\u202e",
      "\\u200b",
      "\\u2066",
      "\\u007f",
      "\\udb40\\udc41",
    ]) {
      expect(result.stdout, escaped).toContain(escaped);
    }
    expect(result.stdout).not.toMatch(/[\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u);
    expect(result.stdout).toContain("é ✓ 日本");
    expect(JSON.parse(result.stdout)).toEqual({ s: NASTY });
  });

  it("escapes the same characters in an error message, a code and a hint", async () => {
    const result = await runInProcess(["status"], () =>
      json({ error: "bad\u202e!", code: "x\u0007y", hint: "h\u009bint\nnext" }, 400),
    );
    expect(result.stderr).toBe(
      "anvilry: x\\u0007y (HTTP 400): bad\\u202e!\nhint: h\\u009bint\\u000anext\n",
    );
  });

  it("escapes what the user typed when it is echoed back in a usage error", async () => {
    const result = await runInProcess([`${ESC}[2Jhi`]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown command "\\u001b[2Jhi"');
    expect(result.stderr).not.toContain(ESC);
  });

  it("leaves a --raw body exactly as received, control characters included", async () => {
    const body = `{"s":"${"\u202e"}x"}`;
    const result = await runInProcess(
      ["profile", "--raw"],
      () => new Response(body),
    );
    expect(result.stdout).toBe(body);
  });
});

describe("a body that is not plain UTF-8", () => {
  const BOM = [0xef, 0xbb, 0xbf];
  const withBytes = (...parts: (string | number[])[]) =>
    Uint8Array.from(
      parts.flatMap((part) =>
        typeof part === "string" ? [...Buffer.from(part)] : part,
      ),
    );

  it("prints --raw byte for byte, whatever the encoding: invalid UTF-8 and a byte-order mark", async () => {
    for (const bytes of [
      withBytes('{"a":"', [0xff, 0xfe], '"}'),
      withBytes(BOM, '{"a":1}'),
      withBytes([0x00, 0x01, 0x02, 0x80]),
    ]) {
      const result = await runInProcess(
        ["profile", "--raw"],
        () => new Response(bytes),
      );
      expect(result.code).toBe(0);
      expect(Buffer.compare(result.stdoutBytes, Buffer.from(bytes))).toBe(0);
    }
  });

  it("parses JSON that starts with a byte-order mark", async () => {
    const result = await runInProcess(
      ["profile"],
      () => new Response(withBytes(BOM, '{"a":1}')),
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ a: 1 });
  });

  it("decodes invalid UTF-8 with replacement characters in the default mode", async () => {
    const result = await runInProcess(
      ["profile"],
      () => new Response(withBytes('{"a":"', [0xff], '"}')),
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ a: "�" });
  });
});

describe("a body that is too large", () => {
  const message = (status: number) =>
    `anvilry: response_too_large (HTTP ${status}): The response body is larger than ${MAX_BODY_BYTES / MIB} MiB (${MAX_BODY_BYTES} bytes), so nothing was printed.\n`;

  it("reads a body of exactly the limit", async () => {
    const result = await runInProcess(
      ["profile", "--raw"],
      () => new Response(new Uint8Array(MAX_BODY_BYTES)),
    );
    expect(result.code).toBe(0);
    expect(result.stdoutBytes.byteLength).toBe(MAX_BODY_BYTES);
  });

  it("refuses one byte more, in the default mode and with --raw", async () => {
    for (const argv of [["profile"], ["profile", "--raw"]]) {
      const result = await runInProcess(
        argv,
        () => new Response(new Uint8Array(MAX_BODY_BYTES + 1)),
      );
      expect(result.code, argv.join(" ")).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(message(200));
    }
  });

  it("refuses a large error body too, naming the status", async () => {
    const result = await runInProcess(
      ["profile"],
      () => new Response(new Uint8Array(MAX_BODY_BYTES + 1), { status: 500 }),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(message(500));
  });

  it("stops reading an endless body instead of waiting for its end", async () => {
    // The stream is "endless" only up to twice the limit and then fails. If the size cap ever
    // regressed, the reader would run into that failure and this test would fail at once (a
    // truly endless stream would keep the event loop busy and never let the test time out).
    const pullsAllowed = (2 * MAX_BODY_BYTES) / MIB;
    let pulls = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > pullsAllowed) {
          controller.error(new Error("the CLI kept reading far past the size limit"));
          return;
        }
        controller.enqueue(new Uint8Array(MIB));
      },
      cancel() {
        cancelled = true;
      },
    });
    const result = await runInProcess(["profile"], () => new Response(endless));
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(message(200));
    expect(cancelled).toBe(true);
    // It read the limit and a little more (the chunk that crossed it), not the whole stream.
    expect(pulls).toBeLessThanOrEqual(MAX_BODY_BYTES / MIB + 2);
  });
});

describe("a body that is JSON but cannot be printed", () => {
  const CANNOT_PRINT =
    /^anvilry: bad_response \(HTTP 200\): Could not print the response \((nested more than 1000 levels deep|it is nested too deeply to read)\)\. Use --raw to print the body unchanged\.\n$/;
  const deep = (levels: number) => "[".repeat(levels) + "]".repeat(levels);

  it.each([10_000, 100_000])(
    "reports a body nested %i levels deep with exit 2 and no stack trace",
    async (levels) => {
      const result = await runInProcess(
        ["profile"],
        () => new Response(deep(levels)),
      );
      expect(result.code).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(CANNOT_PRINT);
      expect(result.stderr).not.toMatch(/RangeError|\n\s+at /);
    },
  );

  it("still hands the same body over byte for byte with --raw", async () => {
    const body = deep(100_000);
    const result = await runInProcess(["profile", "--raw"], () => new Response(body));
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(body);
  });

  it("reports the 8 MB body from the review (3,000 levels around four million values) the same way", async () => {
    const body = `${"[".repeat(3000)}${"1,".repeat(4_000_000)}1${"]".repeat(3000)}`;
    const result = await runInProcess(["profile"], () => new Response(body));
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(CANNOT_PRINT);
  });

  it("refuses a small body whose indented form would be gigantic, saying how big the limit is", async () => {
    // Under the nesting limit, about 200 KB as JSON, but each of 100,000 values would be indented 1,800 spaces.
    const body = `${"[".repeat(900)}${"1,".repeat(100_000)}1${"]".repeat(900)}`;
    const result = await runInProcess(["profile"], () => new Response(body));
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      `anvilry: bad_response (HTTP 200): Could not print the response (its indented form would be larger than ${MAX_PRETTY_CHARS / MIB} MiB). Use --raw to print the body unchanged.\n`,
    );
  });

  it("reports a parser that gave up on the nesting (older Node versions do) the same way", async () => {
    const parse = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw new RangeError("Maximum call stack size exceeded");
    });
    try {
      const result = await runInProcess(["profile"], () => new Response("[[[]]]"));
      expect(result.code).toBe(2);
      expect(result.stderr).toBe(
        "anvilry: bad_response (HTTP 200): Could not print the response (it is nested too deeply to read). Use --raw to print the body unchanged.\n",
      );
    } finally {
      parse.mockRestore();
    }
  });

  it("still prints a body that is nested and large but within the limits", async () => {
    const body = JSON.stringify({ rows: Array.from({ length: 5000 }, (_, index) => ({ index, tags: [["a"]] })) });
    const result = await runInProcess(["profile"], () => new Response(body));
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(body));
  });
});

describe("a redirect", () => {
  const OTHER = "http://other.example/api/v1/profile";
  const redirect =
    (status: number, location: string | null = OTHER) =>
    () =>
      new Response(null, {
        status,
        headers: location === null ? {} : { Location: location },
      });

  it.each([301, 302, 303, 307, 308])(
    "is reported with its Location and not followed (%i)",
    async (status) => {
      const result = await runInProcess(["profile"], redirect(status));
      expect(result.code).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        `anvilry: redirect (HTTP ${status}): The server redirected the request to ${OTHER}. The CLI does not follow redirects; if you trust that address, pass its origin as --base-url.\n`,
      );
      expect(result.calls).toHaveLength(1);
    },
  );

  it("asks fetch not to follow it", async () => {
    const result = await runInProcess(["profile"], redirect(302));
    expect(result.calls[0].init.redirect).toBe("manual");
  });

  it("never sends the batch body a second time", async () => {
    const result = await runInProcess(
      ["batch", "/api/v1/profile"],
      redirect(307),
    );
    expect(result.code).toBe(2);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0].init.method).toBe("POST");
  });

  it("copes with a redirect that has no Location", async () => {
    const result = await runInProcess(["profile"], redirect(302, null));
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(
      "anvilry: redirect (HTTP 302): The server answered with a redirect status and no Location. The CLI does not follow redirects.\n",
    );
  });

  it("escapes a Location that carries control characters", async () => {
    // A header value is bytes, so the characters a server can really send are U+0000 to U+00FF.
    const result = await runInProcess(
      ["profile"],
      redirect(302, "http://other.example/\u009bx"),
    );
    expect(result.stderr).toContain("http://other.example/\\u009bx");
    expect(result.stderr).not.toContain("\u009b");
  });
});
