import { describe, expect, it } from "vitest";
import { escapeForTerminal, escapeJsonOutput } from "../../cli/lib/escape.mjs";
import { MAX_BODY_BYTES } from "../../cli/lib/constants.mjs";
import { json, runInProcess } from "./support/in-process";

/**
 * What the CLI does with a server it has no reason to trust (--base-url can point anywhere): it
 * keeps terminal control sequences out of what it prints, never follows a redirect, prints --raw
 * bytes untouched, and refuses a body that is too large. Run in-process with a scripted fetch.
 */

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
  const MIB = 1024 * 1024;
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
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
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
