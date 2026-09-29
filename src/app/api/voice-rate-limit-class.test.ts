import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the route-to-class mapping (R-11): tts, tts-google and transcribe share the
 * "voice" bucket, which is separate from chat. The limiter denies, so each route
 * returns right after the checkRateLimit call under test.
 */

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() =>
    Promise.resolve({ ok: false as const, retryAfter: 1 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/telemetry/emit", () => ({ emit: vi.fn() }));

const ROUTES = {
  tts: () => import("./tts/route"),
  "tts-google": () => import("./tts-google/route"),
  transcribe: () => import("./transcribe/route"),
} as const;

beforeEach(() => {
  vi.stubEnv("BEDROCK_ACCESS_KEY_ID", "test-access-id");
  vi.stubEnv("BEDROCK_SECRET_ACCESS_KEY", "test-secret-value");
  vi.stubEnv("GOOGLE_TTS_API_KEY", "test-google-key");
});

afterEach(() => {
  checkRateLimitMock.mockClear();
  vi.unstubAllEnvs();
});

describe.each(Object.keys(ROUTES) as (keyof typeof ROUTES)[])(
  "/api/%s rate-limit class",
  (route) => {
  it("charges the voice bucket", async () => {
    const { POST } = await ROUTES[route]();
    const res = await POST(
      new Request(`http://localhost/api/${route}`, { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(429);
    expect(checkRateLimitMock).toHaveBeenCalledWith(expect.any(Request), "voice");
  });
  },
);
