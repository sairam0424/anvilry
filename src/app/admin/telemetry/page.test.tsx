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
