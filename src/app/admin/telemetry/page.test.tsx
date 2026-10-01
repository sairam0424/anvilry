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
  function attempt(model: string, usage: Record<string, number>, cost?: number) {
    return {
      ts: Date.now(),
      kind: "llm.attempt",
      level: "info",
      traceId: "t",
      spanId: "s",
      attrs: {
        model,
        latency_ms: 900,
        usage,
        ...(cost === undefined ? {} : { cost_usd: cost }),
      },
    };
  }

  async function renderWith(events: unknown[]): Promise<string> {
    configure(ADMIN_SECRET);
    headerStore.authorization = basic(ADMIN_SECRET);
    redisMock.zrange.mockImplementation(async (key: string) =>
      key === "anvilry:trace:llm.attempt" ? events : [],
    );
    return renderToStaticMarkup(await TelemetryDashboard());
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
    expect(html).toContain("$0.0045");
    expect(html).toContain("saved $0.0094 by caching");
  });

  it("does not price an unpriced model's cache reads at Sonnet 4.6's rate", async () => {
    const html = await renderWith([
      attempt("claude-sonnet-5-5", { cache_read_input_tokens: 5247 }),
    ]);
    expect(html).toContain("saved $0.0000 by caching");
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
});
