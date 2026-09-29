import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the auth contract shared by all five cron routes: fail-CLOSED 401 with body
 * { error: "Unauthorized" } when CRON_SECRET is unset, the header is missing, or the
 * header is wrong; anything else proceeds past the guard. Written before the guard was
 * extracted to src/lib/cron-auth.ts so the refactor is provably behaviour-preserving.
 */

vi.mock("@/lib/redis", () => ({ redis: null }));
vi.mock("@/lib/content", () => ({
  allArticles: [],
  allNotes: [],
  allWork: [],
  allProjects: [],
}));

const TEST_CRON_VALUE = "unit-test-cron-value";
const ROUTES = [
  "github-sync",
  "content-audit",
  "seo-audit",
  "health-check",
  "eval",
] as const;

function request(authorization?: string): Request {
  return new Request("https://anvilry.test/api/cron/x", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("ok", { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(ROUTES)("cron/%s auth guard", (name) => {
  async function load() {
    return (await import(/* @vite-ignore */ `./${name}/route`)) as {
      GET: (req: Request) => Promise<Response>;
    };
  }

  async function expectUnauthorized(res: Response) {
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  }

  it("401s when CRON_SECRET is unset, even with a matching-looking header", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await load();
    await expectUnauthorized(await GET(request("Bearer ")));
    await expectUnauthorized(await GET(request("Bearer undefined")));
  });

  it("401s when the authorization header is missing", async () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    const { GET } = await load();
    await expectUnauthorized(await GET(request()));
  });

  it("401s on a wrong value, a wrong scheme, and a longer/shorter value", async () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    const { GET } = await load();
    for (const header of [
      "Bearer wrong",
      `Basic ${TEST_CRON_VALUE}`,
      TEST_CRON_VALUE,
      `Bearer ${TEST_CRON_VALUE}x`,
      `Bearer ${TEST_CRON_VALUE.slice(0, -1)}`,
    ]) {
      await expectUnauthorized(await GET(request(header)));
    }
  });

  it("proceeds past the guard with the correct bearer value", async () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    const { GET } = await load();
    const res = await GET(request(`Bearer ${TEST_CRON_VALUE}`));
    expect(res.status).not.toBe(401);
  });
});
