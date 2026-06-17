import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCacheForTest } from "./cache";

/**
 * Validation contract for /api/tts-google. We can't easily exercise the live
 * Google Cloud TTS HTTP endpoint from a unit test, so this suite pins the
 * BEFORE-Google behavior: env gating, body validation, catalog allowlist.
 * Network behavior is covered by a successful fetch mock for the happy path.
 *
 * The route imports `checkRateLimit` from "@/lib/rate-limit", which we no-op
 * here so a real Upstash check (if configured) can't make these tests fail.
 */

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => Promise.resolve({ ok: true, retryAfter: 0 }),
}));

// Mock the emit module so the Redis ZADD inside withTrace/emit() doesn't
// hit the globally-stubbed fetch during happy-path tests that stub fetch
// for the Google TTS API call. Without this, Upstash's REST client calls
// the mocked fetch as a side effect, making the call count assertions fail.
vi.mock("@/lib/telemetry/emit", () => ({
  emit: vi.fn(),
}));

// A clearly-non-secret sentinel string — only its truthiness matters to the route's
// `isConfigured()` gate; never sent to a real API in test.
const FAKE_API_KEY_SENTINEL = "not-a-real-google-key-for-tests";

let POST: (req: Request) => Promise<Response>;

async function importRoute() {
  // Re-import each test so process.env changes take effect (the route reads the
  // env at call time via getApiKey(), so technically a single import would do —
  // but a fresh module also resets the in-process LRU so cross-test state can't
  // bleed).
  vi.resetModules();
  const mod = await import("./route");
  POST = mod.POST;
}

beforeEach(() => {
  __resetCacheForTest();
});

afterEach(() => {
  delete process.env.GOOGLE_TTS_API_KEY;
  vi.unstubAllGlobals();
});

function makeReq(body: unknown): Request {
  const json = JSON.stringify(body);
  return new Request("http://localhost/api/tts-google", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(json.length) },
    body: json,
  });
}

describe("/api/tts-google — env gating", () => {
  it("returns 503 when GOOGLE_TTS_API_KEY is not set (fail-closed)", async () => {
    delete process.env.GOOGLE_TTS_API_KEY;
    await importRoute();
    const res = await POST(makeReq({ text: "hi", voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when GOOGLE_TTS_API_KEY is empty string", async () => {
    process.env.GOOGLE_TTS_API_KEY = "";
    await importRoute();
    const res = await POST(makeReq({ text: "hi", voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(503);
  });
});

describe("/api/tts-google — body validation (with key set)", () => {
  beforeEach(async () => {
    process.env.GOOGLE_TTS_API_KEY = FAKE_API_KEY_SENTINEL;
    await importRoute();
  });

  it("400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/tts-google", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "8" },
      body: "{not jso",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400 when text is missing", async () => {
    const res = await POST(makeReq({ voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(400);
  });

  it("400 when text is empty after trim", async () => {
    const res = await POST(makeReq({ text: "   ", voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(400);
  });

  it("400 when voiceId is missing (Google route requires explicit pick)", async () => {
    const res = await POST(makeReq({ text: "hi" }));
    expect(res.status).toBe(400);
  });

  it("400 when voiceId is unknown to the catalog", async () => {
    const res = await POST(makeReq({ text: "hi", voiceId: "made-up-voice" }));
    expect(res.status).toBe(400);
  });

  it("400 when voiceId is a Polly catalog id (cross-engine attack)", async () => {
    const res = await POST(makeReq({ text: "hi", voiceId: "polly-neural-joanna" }));
    expect(res.status).toBe(400);
  });

  it("413 when content-length exceeds 8KB", async () => {
    const big = "x".repeat(9_000);
    const req = new Request("http://localhost/api/tts-google", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(9_500) },
      body: JSON.stringify({ text: big, voiceId: "google-chirp3-aoede" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});

describe("/api/tts-google — happy path (fetch mocked)", () => {
  beforeEach(async () => {
    process.env.GOOGLE_TTS_API_KEY = FAKE_API_KEY_SENTINEL;
    await importRoute();
  });

  it("returns audio/mpeg bytes for a valid request, decoding base64 from Google", async () => {
    const fakeMp3 = Buffer.from("fake-mp3-bytes");
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ audioContent: fakeMp3.toString("base64") }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeReq({ text: "Hello", voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("X-TTS-Cache")).toBe("miss");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body).toEqual(fakeMp3);

    // The request body forwarded to Google must include languageCode + name from
    // the catalog. Verify the shape.
    const mock = vi.mocked(fetchMock);
    expect(mock).toHaveBeenCalledOnce();
    const [, init] = mock.mock.calls[0]!;
    const sent = JSON.parse(init!.body as string);
    expect(sent).toEqual({
      input: { text: "Hello" },
      voice: { languageCode: "en-US", name: "en-US-Chirp3-HD-Aoede" },
      audioConfig: { audioEncoding: "MP3" },
    });
  });

  it("returns 502 when Google returns a non-2xx", async () => {
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response("rate limited", { status: 429 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(makeReq({ text: "hi", voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when Google returns no audioContent field", async () => {
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "something" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(makeReq({ text: "hi", voiceId: "google-chirp3-aoede" }));
    expect(res.status).toBe(502);
  });

  it("second request for the same text+voice serves a cache hit", async () => {
    const fakeMp3 = Buffer.from("audio-cached");
    const fetchMock: typeof fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ audioContent: fakeMp3.toString("base64") }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r1 = await POST(makeReq({ text: "cached", voiceId: "google-chirp3-aoede" }));
    expect(r1.headers.get("X-TTS-Cache")).toBe("miss");

    const r2 = await POST(makeReq({ text: "cached", voiceId: "google-chirp3-aoede" }));
    expect(r2.headers.get("X-TTS-Cache")).toBe("hit");

    // Google was hit exactly once for the two identical requests.
    expect(vi.mocked(fetchMock)).toHaveBeenCalledOnce();
  });
});
