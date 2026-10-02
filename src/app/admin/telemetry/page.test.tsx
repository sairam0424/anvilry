import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Defense-in-depth contract: the telemetry page must enforce Basic auth itself,
 * so a proxy matcher bypass cannot expose the dashboard. The page is asserted to
 * bail out (notFound) BEFORE it reads anything from Redis.
 */

const { headerStore, redisMock, notFoundError } = vi.hoisted(() => ({
  headerStore: { authorization: null as string | null },
  redisMock: { zrange: vi.fn(), get: vi.fn() },
  notFoundError: new Error("NEXT_NOT_FOUND"),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers(
        headerStore.authorization
          ? { Authorization: headerStore.authorization }
          : {},
      ),
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw notFoundError;
  }),
}));

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/redis", () => ({ redis: redisMock }));

import TelemetryDashboard from "./page";

const ADMIN_SECRET = "good";

function configure(value: string): void {
  process.env.ADMIN_PASSWORD = value;
}

function basic(secret: string): string {
  return "Basic " + Buffer.from(`admin:${secret}`).toString("base64");
}

beforeEach(() => {
  headerStore.authorization = null;
  redisMock.zrange.mockReset().mockResolvedValue([]);
  redisMock.get.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("TelemetryDashboard — page-level auth", () => {
  it("calls notFound and never reads redis without credentials", async () => {
    configure(ADMIN_SECRET);
    await expect(TelemetryDashboard()).rejects.toBe(notFoundError);
    expect(redisMock.zrange).not.toHaveBeenCalled();
  });

  it("calls notFound for a wrong credential", async () => {
    configure(ADMIN_SECRET);
    headerStore.authorization = basic("bad");
    await expect(TelemetryDashboard()).rejects.toBe(notFoundError);
    expect(redisMock.zrange).not.toHaveBeenCalled();
  });

  it("calls notFound when ADMIN_PASSWORD is unset", async () => {
    headerStore.authorization = basic(ADMIN_SECRET);
    await expect(TelemetryDashboard()).rejects.toBe(notFoundError);
  });

  it("renders for correct credentials", async () => {
    configure(ADMIN_SECRET);
    headerStore.authorization = basic(ADMIN_SECRET);
    await expect(TelemetryDashboard()).resolves.toBeTruthy();
    expect(redisMock.zrange).toHaveBeenCalled();
  });
});

describe("TelemetryDashboard — cost tiles use each model's own verified price", () => {
  function attempt(
    model: string,
    usage?: Record<string, number>,
    cost?: number,
  ) {
    return {
      ts: Date.now(),
      kind: "llm.attempt",
      level: "info",
      traceId: "t",
      spanId: "s",
      attrs: {
        model,
        latency_ms: 900,
        ...(usage === undefined ? {} : { usage }),
        ...(cost === undefined ? {} : { cost_usd: cost }),
      },
    };
  }

  async function renderWith(
    events: unknown[],
    otherKinds: Record<string, unknown[]> = {},
  ): Promise<string> {
    configure(ADMIN_SECRET);
    headerStore.authorization = basic(ADMIN_SECRET);
    redisMock.zrange.mockImplementation(async (key: string) =>
      key === "anvilry:trace:llm.attempt"
        ? events
        : (otherKinds[key.replace("anvilry:trace:", "")] ?? []),
    );
    return renderToStaticMarkup(await TelemetryDashboard());
  }

  /** The value and sub line of a <Tile>, read from the markup, so an assertion cannot
   *  be satisfied by the same figure showing up somewhere else on the page. */
  function tile(html: string, label: string): { value: string; sub: string } {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = html.match(
      new RegExp(
        `${escaped}</span><span[^>]*>([^<]*)</span>(?:<span[^>]*>([^<]*)</span>)?`,
      ),
    );
    if (!m) throw new Error(`tile "${label}" not found`);
    return { value: m[1], sub: m[2] ?? "" };
  }

  it("adds the cost of each attempt and the input cost its cache reads avoided", async () => {
    const html = await renderWith([
      // Sonnet 5.5 (global): 5247 cache-read tokens avoid 5247 x ($2.00 - $0.20) / 1e6 = $0.0094
      attempt(
        "global.anthropic.claude-sonnet-5-5",
        { input_tokens: 29, cache_read_input_tokens: 5247, output_tokens: 286 },
        0.0045,
      ),
    ]);
    expect(tile(html, "Est. cost (24h)")).toEqual({
      value: "$0.0045",
      sub: "saved $0.0094 by caching",
    });
  });

  it("does not price an unpriced model's cache reads at Sonnet 4.6's rate", async () => {
    const html = await renderWith([
      attempt("claude-sonnet-5-5", { cache_read_input_tokens: 5247 }),
    ]);
    expect(html).toContain("saved $0.0000 by caching");
  });

  it("shortens global. model ids in the events table and the model cost table, like us. ids", async () => {
    // Sonnet 5.5 is served only from the global profile, so its id is global.anthropic.*;
    // only the us. prefix used to be stripped and the id printed in full.
    const html = await renderWith([
      attempt(
        "global.anthropic.claude-sonnet-5-5",
        { input_tokens: 10, output_tokens: 10 },
        0.001,
      ),
      attempt(
        "us.anthropic.claude-sonnet-4-6",
        { input_tokens: 10, output_tokens: 10 },
        0.002,
      ),
    ]);
    expect(html).not.toContain("global.anthropic.claude-");
    expect(html).not.toContain("us.anthropic.claude-");
    expect(html).toContain(">sonnet-5-5<");
    expect(html).toContain(">sonnet-4-6<");
    expect(html).toContain("sonnet-5-5  ·  in:10");
  });

  it("sums savings across models at their own rates", async () => {
    const html = await renderWith([
      attempt("global.anthropic.claude-sonnet-5-5", {
        cache_read_input_tokens: 1_000_000,
      }), // $1.80
      attempt("us.anthropic.claude-sonnet-4-6", {
        cache_read_input_tokens: 1_000_000,
      }), // $2.97
    ]);
    expect(html).toContain("saved $4.7700 by caching");
  });

  it("the Est. cost tile is the sum of cost_usd over the attempts, not just any dollar figure on the page", async () => {
    // $0.0045 also shows in the model cost table and the recent-events feed, so a
    // substring check on the whole page cannot tell the tile from them.
    const html = await renderWith([
      attempt(
        "global.anthropic.claude-sonnet-5-5",
        { input_tokens: 10 },
        0.0045,
      ),
      attempt("us.anthropic.claude-sonnet-4-6", { input_tokens: 10 }, 0.003),
    ]);
    expect(tile(html, "Est. cost (24h)").value).toBe("$0.0075");
  });

  it("renders an attempt that failed before any usage arrived (a 429 at connect has no usage block)", async () => {
    const html = await renderWith([
      attempt("global.anthropic.claude-sonnet-5-5"),
      attempt(
        "us.anthropic.claude-sonnet-4-6",
        { cache_read_input_tokens: 1_000_000 },
        0.0005,
      ),
    ]);
    expect(tile(html, "Est. cost (24h)")).toEqual({
      value: "$0.0005",
      sub: "saved $2.9700 by caching",
    });
  });

  it("shortens global. model ids in the FAQ-cache rows of the events feed too", async () => {
    const html = await renderWith([], {
      "chat.cache": [
        {
          ts: Date.now(),
          kind: "chat.cache",
          level: "info",
          traceId: "t2",
          spanId: "s2",
          attrs: {
            outcome: "hit",
            tier: "exact",
            model: "global.anthropic.claude-sonnet-5-5",
            saved_usd: 0.0123,
          },
        },
      ],
    });
    expect(html).not.toContain("global.anthropic.claude-");
    expect(html).toContain(
      "hit  ·  tier:exact  ·  sonnet-5-5  ·  saved:$0.0123",
    );
  });
});

describe("TelemetryDashboard — the corpus age tile reads the corpus stamp", () => {
  const HOUR = 3_600_000;

  /** The value and sub line of the "Corpus age" tile for a given `anvilry:corpus:built_at`. */
  async function corpusTile(stamp: unknown): Promise<{ value: string; sub: string }> {
    configure(ADMIN_SECRET);
    headerStore.authorization = basic(ADMIN_SECRET);
    redisMock.get.mockImplementation(async (key: string) =>
      key === "anvilry:corpus:built_at" ? stamp : null,
    );
    const html = renderToStaticMarkup(await TelemetryDashboard());
    const m = html.match(
      /Corpus age<\/span><span[^>]*>([^<]*)<\/span>(?:<span[^>]*>([^<]*)<\/span>)?/,
    );
    if (!m) throw new Error('tile "Corpus age" not found');
    return { value: m[1], sub: m[2] ?? "" };
  }

  it("reads the leading timestamp of a stamp that carries a deployment id", async () => {
    // register() writes `<ms of the deployment's first start>:<deployment id>`.
    const builtAt = Date.now() - 5 * HOUR;
    expect(await corpusTile(`${builtAt}:dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3`)).toEqual({
      value: "5h ago",
      sub: `Last deployed: ${new Date(builtAt).toLocaleDateString()}`,
    });
  });

  it.each([
    ["a bare timestamp string", (ms: number) => String(ms)],
    ["a number, which is how the Upstash SDK returns a numeric string", (ms: number) => ms],
  ])("still reads %s, as the previous release wrote it", async (_label, make) => {
    const builtAt = Date.now() - 3 * HOUR;
    expect(await corpusTile(make(builtAt))).toEqual({
      value: "3h ago",
      sub: `Last deployed: ${new Date(builtAt).toLocaleDateString()}`,
    });
  });

  it("shows no age until a production deployment has stamped the corpus", async () => {
    expect(await corpusTile(null)).toEqual({
      value: "—",
      sub: "set on production cold start",
    });
  });
});
