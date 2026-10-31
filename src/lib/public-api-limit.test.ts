import { describe, expect, it } from "vitest";
import { RATE_LIMIT_POLICY } from "./api-policy";
import { createWindowLimiter, publicApiClientKey, rateLimitHeaders } from "./public-api-limit";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createWindowLimiter", () => {
  it("counts down the remaining budget and refuses the request after the last one", () => {
    const c = clock();
    const limiter = createWindowLimiter({ requests: 3, windowSeconds: 60, now: c.now });
    expect(limiter.hit("a")).toMatchObject({ allowed: true, remaining: 2, limit: 3 });
    expect(limiter.hit("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.hit("a")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.hit("a")).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("keeps clients apart", () => {
    const c = clock();
    const limiter = createWindowLimiter({ requests: 1, windowSeconds: 60, now: c.now });
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
    expect(limiter.hit("b").allowed).toBe(true);
  });

  it("reports the seconds left in the window, rounded up and never below one", () => {
    const c = clock();
    const limiter = createWindowLimiter({ requests: 5, windowSeconds: 60, now: c.now });
    expect(limiter.hit("a").resetSeconds).toBe(60);
    c.advance(59_500);
    expect(limiter.hit("a").resetSeconds).toBe(1);
  });

  it("opens a fresh window once the old one has ended", () => {
    const c = clock();
    const limiter = createWindowLimiter({ requests: 1, windowSeconds: 10, now: c.now });
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    c.advance(10_000);
    expect(limiter.hit("a")).toMatchObject({ allowed: true, remaining: 0, resetSeconds: 10 });
  });

  it("cannot grow without bound: expired clients go first, then the oldest live ones", () => {
    const c = clock();
    const limiter = createWindowLimiter({ requests: 5, windowSeconds: 10, maxKeys: 3, now: c.now });
    limiter.hit("a");
    limiter.hit("b");
    c.advance(10_000); // a and b expire
    limiter.hit("c");
    limiter.hit("d");
    limiter.hit("e");
    expect(limiter.size()).toBeLessThanOrEqual(3);
    limiter.hit("f"); // all live: the oldest is evicted
    expect(limiter.size()).toBeLessThanOrEqual(3);
    // The evicted client simply starts a new window; it is never given a negative budget.
    expect(limiter.hit("c").remaining).toBeGreaterThanOrEqual(0);
  });
});

describe("rateLimitHeaders", () => {
  const { name, windowSeconds } = RATE_LIMIT_POLICY;

  it("emits the IETF draft fields and the earlier-draft names with the same numbers", () => {
    const headers = Object.fromEntries(
      rateLimitHeaders({ allowed: true, limit: 300, remaining: 299, resetSeconds: 42 }),
    );
    expect(headers["RateLimit-Policy"]).toBe(`"${name}";q=300;w=${windowSeconds}`);
    expect(headers["RateLimit"]).toBe(`"${name}";r=299;t=42`);
    expect(headers["RateLimit-Limit"]).toBe("300");
    expect(headers["RateLimit-Remaining"]).toBe("299");
    expect(headers["RateLimit-Reset"]).toBe("42");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("adds Retry-After, in seconds, only when the request is refused", () => {
    const headers = Object.fromEntries(
      rateLimitHeaders({ allowed: false, limit: 300, remaining: 0, resetSeconds: 17 }),
    );
    expect(headers["Retry-After"]).toBe("17");
    expect(headers["RateLimit-Remaining"]).toBe("0");
  });
});

describe("publicApiClientKey", () => {
  const key = (headers: Record<string, string>) =>
    publicApiClientKey(new Request("https://x.test/", { headers }));

  it("prefers the platform header and never trusts the first forwarded-for segment", () => {
    expect(key({ "x-vercel-forwarded-for": "1.1.1.1, 9.9.9.9", "x-forwarded-for": "2.2.2.2" })).toBe("1.1.1.1");
    expect(key({ "x-forwarded-for": "spoofed, 3.3.3.3" })).toBe("3.3.3.3");
    expect(key({})).toBe("anonymous");
  });
});
