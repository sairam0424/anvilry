import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMIT_POLICY } from "./api-policy";
import { PRIVACY_FACTS } from "./privacy-facts";

/**
 * Every number the privacy page prints is read back out of the code that enforces it. A limit that
 * changes in the code turns this red until PRIVACY_FACTS (and so the published text) is updated.
 */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

function constant(path: string, name: string): number {
  const match = new RegExp(`${name}\\s*=\\s*([0-9_ *]+?)\\s*[;/]`).exec(source(path));
  expect(match, `${name} in ${path}`).toBeTruthy();
  return Function(`"use strict"; return (${match![1].replace(/_/g, "")});`)() as number;
}

describe("PRIVACY_FACTS match the enforcing code", () => {
  it("chat keeps the last 12 messages of at most 600 characters", () => {
    expect(constant("src/app/api/chat/route.ts", "MAX_MESSAGES")).toBe(PRIVACY_FACTS.chatMessagesKept);
    expect(constant("src/app/api/chat/route.ts", "MAX_CHARS")).toBe(PRIVACY_FACTS.chatCharsPerMessage);
  });

  it("the FAQ cache lives 24 hours", () => {
    expect(constant("src/lib/chat-cache.ts", "FAQ_CACHE_TTL_SECONDS")).toBe(
      PRIVACY_FACTS.faqCacheHours * 3600,
    );
  });

  it("both speech routes cap spoken text at 600 characters", () => {
    expect(constant("src/app/api/tts/route.ts", "MAX_CHARS")).toBe(PRIVACY_FACTS.ttsCharsPerRequest);
    expect(constant("src/app/api/tts-google/route.ts", "MAX_CHARS")).toBe(PRIVACY_FACTS.ttsCharsPerRequest);
  });

  it("the rate limit is 8 requests per 60 seconds", () => {
    expect(constant("src/lib/rate-limit.ts", "REQUESTS_PER_WINDOW")).toBe(PRIVACY_FACTS.rateLimitRequests);
    expect(source("src/lib/rate-limit.ts")).toContain(
      `WINDOW = "${PRIVACY_FACTS.rateLimitWindowSeconds} s"`,
    );
  });

  it("the public API limit printed on the page is the one the proxy enforces, held in memory only", () => {
    expect(PRIVACY_FACTS.publicApiRequests).toBe(RATE_LIMIT_POLICY.requests);
    expect(PRIVACY_FACTS.publicApiWindowSeconds).toBe(RATE_LIMIT_POLICY.windowSeconds);
    // The page promises the counter never leaves server memory: the limiter must not touch Redis.
    const code = source("src/lib/public-api-limit.ts").replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");
    expect(code).toContain("new Map<string, Bucket>()");
    expect(code).not.toMatch(/upstash|redis/i);
  });

  it("error reports are trimmed to 7 days and the recent list to 50 entries", () => {
    expect(constant("src/lib/telemetry/emit.ts", "SEVEN_DAYS_MS")).toBe(
      PRIVACY_FACTS.errorRetentionDays * 86_400_000,
    );
    expect(source("src/app/api/error/route.ts")).toContain(
      `ltrim("anvilry:errors:recent", 0, ${PRIVACY_FACTS.recentErrorsKept - 1})`,
    );
  });

  it("the command palette remembers 5 recent items", () => {
    expect(constant("src/components/command-palette-content.tsx", "RECENT_MAX")).toBe(
      PRIVACY_FACTS.recentCommandsKept,
    );
  });

  it("private transcription accepts at most 5 MiB of audio", () => {
    expect(constant("src/app/api/transcribe/route.ts", "MAX_BYTES")).toBe(
      PRIVACY_FACTS.transcribeMaxMegabytes * 1024 * 1024,
    );
  });

  it("states nothing the code contradicts about cookies", () => {
    const hits = [
      "src/app/layout.tsx",
      "src/proxy.ts",
      "src/lib/theme-context.tsx",
      "src/lib/voice-settings-context.tsx",
    ].filter((file) => /document\.cookie|\.cookies\.set|Set-Cookie/i.test(source(file)));
    expect(hits).toEqual([]);
  });
});
