import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { REPO_ALLOWLIST, getRepoFeed, fetchRepo, pushedAgo } from "./github";

/**
 * Contract for the first-party GitHub feed: it is ALLOWLIST-gated, FAIL-OPEN, and
 * renders-only-what-resolves. A recruiter must never see an error — every failure
 * path (missing token, 404, rate-limit, network error) degrades to fewer cards or
 * none. We stub global.fetch (matching the repo's vi.stubGlobal idiom) so these run
 * with zero network in CI.
 */

const okRepo = (
  name: string,
  pushedAt: string,
  extra: Record<string, unknown> = {},
) =>
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

const notFound = () =>
  ({ ok: false, status: 404, json: async () => ({}) }) as Response;

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => notFound()),
    );
    await expect(getRepoFeed()).resolves.toEqual([]);
  });

  it("returns [] on a network error (degrades, never throws into render)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    );
    await expect(getRepoFeed()).resolves.toEqual([]);
  });

  it("renders only the repos that resolve (drops 404s)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/ag-bash")
          ? okRepo("ag-bash", "2026-06-10T00:00:00Z")
          : notFound(),
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
    expect(feed.map((r) => r.name)).toEqual([
      "MindForge",
      "ContextOS",
      "ag-bash",
    ]);
  });

  it("does NOT send an Authorization header when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => notFound());
    vi.stubGlobal("fetch", spy);
    await getRepoFeed();
    const headers = (spy.mock.calls[0]?.[1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends a Bearer Authorization header when GITHUB_TOKEN is set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_test123");
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => notFound());
    vi.stubGlobal("fetch", spy);
    await getRepoFeed();
    const headers = (spy.mock.calls[0]?.[1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer ghp_test123");
  });
});

describe("fetchRepo (exported single-repo lookup, used by the project detail page)", () => {
  it("resolves an allowlisted repo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okRepo("Tombstone", "2026-06-21T00:00:00Z")),
    );
    const repo = await fetchRepo("sairam0424", "Tombstone");
    expect(repo?.name).toBe("Tombstone");
    expect(repo?.pushedAt).toBe("2026-06-21T00:00:00Z");
  });

  it("returns null without fetching when the name isn't on REPO_ALLOWLIST", async () => {
    const spy = vi.fn(async () =>
      okRepo("not-allowed", "2026-06-21T00:00:00Z"),
    );
    vi.stubGlobal("fetch", spy);
    const repo = await fetchRepo("sairam0424", "not-allowed");
    expect(repo).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("pushedAgo", () => {
  const NOW = new Date("2026-06-30T00:00:00Z");

  beforeEach(() => vi.setSystemTime(NOW));
  afterEach(() => vi.useRealTimers());

  it("returns '' for an empty or unparseable timestamp", () => {
    expect(pushedAgo("")).toBe("");
    expect(pushedAgo("not-a-date")).toBe("");
  });

  it("formats a same-day push", () => {
    expect(pushedAgo(NOW.toISOString())).toBe("today");
  });

  it("formats a days-ago push", () => {
    expect(pushedAgo("2026-06-27T00:00:00Z")).toBe("3 days ago");
  });

  it("formats a weeks-ago push", () => {
    expect(pushedAgo("2026-06-14T00:00:00Z")).toBe("2 weeks ago");
  });

  it("formats a months-ago push", () => {
    expect(pushedAgo("2026-04-01T00:00:00Z")).toBe("3 months ago");
  });

  it("formats a years-ago push", () => {
    expect(pushedAgo("2024-06-30T00:00:00Z")).toBe("2 years ago");
  });
});
