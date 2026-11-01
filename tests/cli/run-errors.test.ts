import { describe, expect, it } from "vitest";
import { json, runInProcess } from "./support/in-process";

/** Everything the CLI prints when the answer is not a plain success, run in-process with a scripted fetch. */

describe("an API error", () => {
  const notFound = () =>
    json(
      {
        error: "No project exists at this path.",
        code: "not_found",
        status: 404,
        hint: "Valid slugs: trelix, tombstone.",
        docs: "https://anvilry.vercel.app/developers#errors",
      },
      404,
    );

  it("prints code, message and hint on stderr, nothing on stdout, and exits 2", async () => {
    const result = await runInProcess(["projects", "nope"], notFound);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      [
        "anvilry: not_found (HTTP 404): No project exists at this path.",
        "hint: Valid slugs: trelix, tombstone.",
        "",
      ].join("\n"),
    );
  });

  it("prints the headers first when --headers is given", async () => {
    const result = await runInProcess(["projects", "nope", "--headers"], () =>
      json({ error: "x", code: "not_found", status: 404 }, 404, {
        "API-Version": "1",
      }),
    );
    expect(result.stderr).toBe(
      "api-version: 1\nanvilry: not_found (HTTP 404): x\n",
    );
  });

  it("prints no hint line when the body has none", async () => {
    const result = await runInProcess(["status"], () =>
      json({ error: "Broken.", code: "internal_error", status: 500 }, 500),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toBe("anvilry: internal_error (HTTP 500): Broken.\n");
  });

  it("handles an error that is not in the API's JSON format", async () => {
    const html = () =>
      new Response("<html>Bad gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });
    const result = await runInProcess(["status"], html);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "anvilry: http_error (HTTP 502): The server answered with an error that is not in the API's JSON error format.\n",
    );
  });

  it("falls back to http_error when a JSON error body has no code", async () => {
    const result = await runInProcess(["status"], () =>
      json({ error: "No code." }, 400),
    );
    expect(result.stderr).toBe("anvilry: http_error (HTTP 400): No code.\n");
  });

  it("treats a JSON body without an error string as an unknown error format", async () => {
    for (const body of [[], null, { message: "x" }, { error: 5 }]) {
      const result = await runInProcess(["status"], () => json(body, 500));
      expect(result.code).toBe(2);
      expect(result.stderr).toContain("not in the API's JSON error format");
    }
  });

  it("writes control characters from the server as \\uXXXX escapes before printing them", async () => {
    const result = await runInProcess(["status"], () =>
      json(
        {
          error: "bad \u001b[31mred\u001b[0m\nnext line",
          code: "x\u0007y",
          hint: "h\u009bint",
        },
        400,
      ),
    );
    expect(result.stderr).toBe(
      "anvilry: x\\u0007y (HTTP 400): bad \\u001b[31mred\\u001b[0m\\u000anext line\nhint: h\\u009bint\n",
    );
    expect(result.stderr).not.toMatch(/[\u001b\u0007\u009b]/);
  });
});

describe("rate limiting", () => {
  const limited = (headers: Record<string, string> = {}) =>
    json(
      {
        error: "Too many requests from this client.",
        code: "rate_limited",
        status: 429,
        hint: "Wait for the number of seconds in the Retry-After header, then retry.",
        docs: "https://anvilry.vercel.app/developers#errors",
      },
      429,
      {
        "API-Version": "1",
        "Retry-After": "42",
        "RateLimit-Policy": '"default";q=300;w=60',
        RateLimit: '"default";r=0;t=42',
        "RateLimit-Limit": "300",
        "RateLimit-Remaining": "0",
        "RateLimit-Reset": "42",
        ...headers,
      },
    );

  it("prints the Retry-After seconds and every rate-limit field, and exits 2", async () => {
    const result = await runInProcess(["profile"], () => limited());
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      [
        "anvilry: rate_limited (HTTP 429): Too many requests from this client. Retry after 42 seconds.",
        "retry-after: 42",
        "api-version: 1",
        'ratelimit-policy: "default";q=300;w=60',
        'ratelimit: "default";r=0;t=42',
        "ratelimit-limit: 300",
        "ratelimit-remaining: 0",
        "ratelimit-reset: 42",
        "hint: Wait for the number of seconds in the Retry-After header, then retry.",
        "",
      ].join("\n"),
    );
  });

  it("does not print the fields twice when --headers is also given", async () => {
    const plain = await runInProcess(["profile"], () => limited());
    const withHeaders = await runInProcess(["profile", "--headers"], () => limited());
    expect(withHeaders.stderr).toBe(plain.stderr);
  });

  it("copes with a 429 that has no JSON body and no Retry-After", async () => {
    const result = await runInProcess(
      ["profile"],
      () => new Response("slow down", { status: 429 }),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toBe(
      "anvilry: rate_limited (HTTP 429): Too many requests.\n",
    );
  });

  it("quotes an HTTP-date Retry-After as it came", async () => {
    const date = "Wed, 21 Oct 2026 07:28:00 GMT";
    const result = await runInProcess(["profile"], () =>
      limited({ "Retry-After": date }),
    );
    expect(result.stderr).toContain(`Retry after ${date}.`);
    expect(result.stderr).not.toContain(`${date} seconds`);
  });
});

describe("an answer that is not what the CLI expects", () => {
  it("fails a 200 that is not JSON, names the content type and suggests --raw", async () => {
    const result = await runInProcess(
      ["profile"],
      () =>
        new Response("<html>login</html>", {
          headers: { "Content-Type": "text/html" },
        }),
    );
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "anvilry: bad_response (HTTP 200): Expected a JSON body but received text/html. Use --raw to print the body unchanged.\n",
    );
  });

  it("fails an empty 200 as not JSON, even without a content type", async () => {
    const result = await runInProcess(
      ["status"],
      () => new Response("", { status: 200 }),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("bad_response");
  });

  it("fails a 3xx without a Location as a redirect it did not follow", async () => {
    const result = await runInProcess(
      ["status"],
      () => new Response(null, { status: 304 }),
    );
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("redirect (HTTP 304)");
  });
});
