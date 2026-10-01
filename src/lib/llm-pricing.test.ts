import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CACHE_WRITE_TTL,
  cacheReadSavingsUsd,
  costUsd,
  priceFor,
} from "./llm-pricing";
import { modelChain } from "./llm";

/**
 * The cost table behind the `cost_usd` on every llm.attempt event (and the
 * dashboard's spend tiles). Rows are AWS's own on-demand list prices for the
 * us-east-1 source region (AWS Price List, offer AmazonBedrockFoundationModels,
 * version 20260930001912, published 2026-09-30), USD per million tokens:
 *
 *  - `us.` ids are the geographic cross-region profile, billed at the "Regional
 *    CRIS" rate, which sits 10% above the Global rate;
 *  - `global.` ids are billed at the Global rate.
 *
 * The old table priced Sonnet 5.5 as Sonnet 4.6 (it had no row), priced Sonnet 4.6
 * at the Global rate although the app uses the `us.` profile, carried Haiku 3.5 and
 * Opus 4 numbers for Haiku 4.5 and Opus 4.6, and priced every cache write at the
 * 5-minute rate although the route asks for a 1-hour TTL. Each is pinned below.
 */

const M = 1_000_000;

describe("priceFor — rows copied from the AWS Price List", () => {
  it("prices Sonnet 5.5 on the global profile at the Global rate", () => {
    expect(priceFor("global.anthropic.claude-sonnet-5-5")).toEqual({
      input: 2.0,
      output: 10.0,
      cacheRead: 0.2,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4.0,
    });
  });

  it("prices the `us.` profiles at the Regional CRIS rate (10% over Global)", () => {
    expect(priceFor("us.anthropic.claude-sonnet-4-6")).toEqual({
      input: 3.3,
      output: 16.5,
      cacheRead: 0.33,
      cacheWrite5m: 4.125,
      cacheWrite1h: 6.6,
    });
    expect(priceFor("us.anthropic.claude-sonnet-5")).toEqual({
      input: 2.2,
      output: 11.0,
      cacheRead: 0.22,
      cacheWrite5m: 2.75,
      cacheWrite1h: 4.4,
    });
    expect(priceFor("us.anthropic.claude-haiku-4-5-20251001-v1:0")).toEqual({
      input: 1.1,
      output: 5.5,
      cacheRead: 0.11,
      cacheWrite5m: 1.375,
      cacheWrite1h: 2.2,
    });
    expect(priceFor("us.anthropic.claude-opus-4-6-v1")).toEqual({
      input: 5.5,
      output: 27.5,
      cacheRead: 0.55,
      cacheWrite5m: 6.875,
      cacheWrite1h: 11.0,
    });
  });

  it("returns null for a model it has no verified price for (never a silent guess)", () => {
    expect(priceFor("us.anthropic.claude-sonnet-9")).toBeNull();
    // The direct-API ids are not on the Bedrock price list.
    expect(priceFor("claude-sonnet-5-5")).toBeNull();
    expect(priceFor("claude-sonnet-4-6")).toBeNull();
    expect(priceFor("")).toBeNull();
  });
});

describe("costUsd", () => {
  it("sums input, output, cache-read and cache-write tokens at the model's rates", () => {
    // A warm Sonnet 5.5 turn measured live: 29 fresh input tokens, 5247 cache
    // read, 286 output.
    const cost = costUsd("global.anthropic.claude-sonnet-5-5", {
      input_tokens: 29,
      cache_read_input_tokens: 5247,
      output_tokens: 286,
    });
    expect(cost).toBeCloseTo((29 * 2.0 + 5247 * 0.2 + 286 * 10.0) / M, 10);
  });

  it("prices cache WRITES at the 1-hour rate, because the chat route asks for a 1-hour TTL", () => {
    expect(CACHE_WRITE_TTL).toBe("1h");
    const oneMillion = costUsd("global.anthropic.claude-sonnet-5-5", {
      cache_creation_input_tokens: M,
    });
    expect(oneMillion).toBeCloseTo(4.0, 10); // not the 5-minute $2.50
    expect(
      costUsd("us.anthropic.claude-sonnet-4-6", {
        cache_creation_input_tokens: M,
      }),
    ).toBeCloseTo(6.6, 10); // not the old $3.75
  });

  it("treats missing usage fields as zero", () => {
    expect(costUsd("global.anthropic.claude-sonnet-5-5", {})).toBe(0);
  });

  it("is null for an unpriced model, so telemetry omits cost_usd instead of inventing one", () => {
    expect(
      costUsd("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 1000 }),
    ).toBeNull();
  });

  it("prices Sonnet 5.5 below Sonnet 4.6 on the token counts measured 2026-10-01, despite ~45% more prompt tokens", () => {
    // Same prompt, measured live on 2026-10-01: 3618 cached tokens on 4.6 vs 5247
    // on 5.5 (+45%), 228 vs 286 output tokens on average. Prices are the point.
    const warm46 = costUsd("us.anthropic.claude-sonnet-4-6", {
      input_tokens: 25,
      cache_read_input_tokens: 3618,
      output_tokens: 228,
    });
    const warm55 = costUsd("global.anthropic.claude-sonnet-5-5", {
      input_tokens: 29,
      cache_read_input_tokens: 5247,
      output_tokens: 286,
    });
    const cold46 = costUsd("us.anthropic.claude-sonnet-4-6", {
      input_tokens: 25,
      cache_creation_input_tokens: 3618,
      output_tokens: 228,
    });
    const cold55 = costUsd("global.anthropic.claude-sonnet-5-5", {
      input_tokens: 29,
      cache_creation_input_tokens: 5247,
      output_tokens: 286,
    });
    expect(warm55!).toBeLessThan(warm46!);
    expect(cold55!).toBeLessThan(cold46!);
  });
});

describe("every model the chat can call has a price", () => {
  const FLAGS = [
    "LLM_PROVIDER",
    "LLM_USE_SONNET_5",
    "LLM_USE_SONNET_5_5",
    "LLM_USE_OPUS_FALLBACK",
  ] as const;

  beforeEach(() => {
    for (const f of FLAGS) delete process.env[f];
  });
  afterEach(() => {
    for (const f of FLAGS) delete process.env[f];
  });

  it("covers the Bedrock chain under every flag combination (a new id without a price row fails the build)", () => {
    const seen = new Set<string>();
    for (const s5 of [undefined, "true"]) {
      for (const s55 of [undefined, "true"]) {
        for (const opus of [undefined, "true"]) {
          process.env.LLM_PROVIDER = "bedrock";
          if (s5) process.env.LLM_USE_SONNET_5 = s5;
          else delete process.env.LLM_USE_SONNET_5;
          if (s55) process.env.LLM_USE_SONNET_5_5 = s55;
          else delete process.env.LLM_USE_SONNET_5_5;
          if (opus) process.env.LLM_USE_OPUS_FALLBACK = opus;
          else delete process.env.LLM_USE_OPUS_FALLBACK;
          for (const id of modelChain()) seen.add(id);
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
    for (const id of seen) {
      expect(priceFor(id), `no price row for ${id}`).not.toBeNull();
    }
  });
});

describe("cacheReadSavingsUsd — what the dashboard's 'saved by caching' adds up", () => {
  it("prices the saving at the model's own input-minus-cache-read rate", () => {
    // 5247 cache-read tokens on Sonnet 5.5 (global): $2.00 - $0.20 = $1.80 per million.
    expect(
      cacheReadSavingsUsd("global.anthropic.claude-sonnet-5-5", {
        cache_read_input_tokens: 5247,
      }),
    ).toBeCloseTo((5247 * 1.8) / M, 10);
    // 3618 on Sonnet 4.6 (us.): $3.30 - $0.33 = $2.97 per million.
    expect(
      cacheReadSavingsUsd("us.anthropic.claude-sonnet-4-6", {
        cache_read_input_tokens: 3618,
      }),
    ).toBeCloseTo((3618 * 2.97) / M, 10);
  });

  it("counts cache reads only: input, output and cache-write tokens add nothing", () => {
    expect(
      cacheReadSavingsUsd("global.anthropic.claude-sonnet-5-5", {
        input_tokens: 9999,
        output_tokens: 9999,
        cache_creation_input_tokens: 9999,
      }),
    ).toBe(0);
  });

  it("is null for a model with no verified price", () => {
    expect(
      cacheReadSavingsUsd("claude-sonnet-5-5", {
        cache_read_input_tokens: 5247,
      }),
    ).toBeNull();
  });

  it.each([
    "global.anthropic.claude-sonnet-5-5",
    "us.anthropic.claude-sonnet-5",
    "us.anthropic.claude-sonnet-4-6",
    "us.anthropic.claude-opus-4-6-v1",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
  ])("is positive for %s: a cache read is cheaper than fresh input", (model) => {
    expect(
      cacheReadSavingsUsd(model, { cache_read_input_tokens: M }),
    ).toBeGreaterThan(0);
  });
});
