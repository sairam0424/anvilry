import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { REPO_ALLOWLIST, getRepoFeed } from "./github";

/**
 * Contract for the first-party GitHub feed: it is ALLOWLIST-gated, FAIL-OPEN, and
 * renders-only-what-resolves. A recruiter must never see an error — every failure
 * path (missing token, 404, rate-limit, network error) degrades to fewer cards or
 * none. We stub global.fetch (matching the repo's vi.stubGlobal idiom) so these run
 * with zero network in CI.
 */

const okRepo = (name: string, pushedAt: string, extra: Record<string, unknown> = {}) =>
  ({
    ok: true,
    json: async () => ({
      full_name: `sairam0424/${name}`,
      html_url: `https://github.com/sairam0424/${name}`,
      description: `${name} description`,
      language: "TypeScript",
      stargazers_count: 3,
      forks_count: 1,
      pushed_at: pushedAt,
      ...extra,
    }),
  }) as Response;

const notFound = () => ({ ok: false, status: 404, json: async () => ({}) }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("REPO_ALLOWLIST", () => {
  it("has no duplicate entries", () => {
    expect(new Set(REPO_ALLOWLIST).size).toBe(REPO_ALLOWLIST.length);
  });

  it("includes the two owner-called-out extras", () => {
    expect(REPO_ALLOWLIST).toContain("Thunderboard-Labs");
    expect(REPO_ALLOWLIST).toContain("Shop.this");
  });
});

describe("getRepoFeed (fail-open, render-only-what-resolves)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("returns [] when every repo fails (rate-limited / private) — never throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => notFound()));
    await expect(getRepoFeed()).resolves.toEqual([]);
  });

  it("returns [] on a network error (degrades, never throws into render)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    await expect(getRepoFeed()).resolves.toEqual([]);
  });

  it("renders only the repos that resolve (drops 404s)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/ag-bash") ? okRepo("ag-bash", "2026-06-10T00:00:00Z") : notFound(),
      ),
    );
    const feed = await getRepoFeed();
    expect(feed).toHaveLength(1);
    expect(feed[0].name).toBe("ag-bash");
    expect(feed[0].url).toBe("https://github.com/sairam0424/ag-bash");
  });

  it("sorts resolved repos newest-push first", async () => {
    const dates: Record<string, string> = {
      "ag-bash": "2026-01-01T00:00:00Z",
      MindForge: "2026-06-01T00:00:00Z",
      ContextOS: "2026-03-01T00:00:00Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const name = Object.keys(dates).find((n) => url.endsWith(`/${n}`));
        return name ? okRepo(name, dates[name]) : notFound();
      }),
    );
    const feed = await getRepoFeed();
    expect(feed.map((r) => r.name)).toEqual(["MindForge", "ContextOS", "ag-bash"]);
  });

  it("does NOT send an Authorization header when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => notFound());
    vi.stubGlobal("fetch", spy);
    await getRepoFeed();
    const headers = (spy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends a Bearer Authorization header when GITHUB_TOKEN is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_test123");
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => notFound());
    vi.stubGlobal("fetch", spy);
    await getRepoFeed();
    const headers = (spy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ghp_test123");
  });
});
