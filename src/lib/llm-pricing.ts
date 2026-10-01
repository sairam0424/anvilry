/**
 * What a chat turn costs, for the `cost_usd` on every `llm.attempt` event and the
 * dashboard's spend tiles.
 *
 * SOURCE: AWS's own on-demand list prices (AWS Price List, offer
 * AmazonBedrockFoundationModels, version 20260930001912, published 2026-09-30),
 * source region us-east-1, "standard" service tier, USD per MILLION tokens. Not a
 * vendor blog or a remembered number: re-read it when a model id below changes, with
 *   https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/index.json
 * (rows are keyed by `servicename` "Claude <model> (Amazon Bedrock Edition)" and a
 * `usagetype` such as USE1_input_tokens_global_standard-Units).
 *
 * WHICH RATE A MODEL ID GETS:
 *  - `us.` ids are the geographic cross-region profile, billed at the "Regional CRIS"
 *    rate (the price file calls the Sonnet 5 / 5.5 rows just "Standard"), 10% above Global;
 *  - `global.` ids are billed at the Global rate.
 * That is why Sonnet 5.5 (global, $2 / $10) is not dearer than Sonnet 4.6 (us., $3.30 /
 * $16.50) although it needs ~45% more prompt tokens for the same text (5247 vs 3618
 * cached tokens). Measured 2026-10-01: 14% / 21% cheaper per turn (cold / warm cache) on
 * 8 questions at effort low, 17% cheaper to 4% dearer on 3 questions at effort medium.
 *
 * Earlier versions of this table (it lived in the chat route) had no Sonnet 5 / 5.5
 * rows and silently priced any unknown model as Sonnet 4.6, used the Global rate for
 * the `us.` Sonnet 4.6, carried Haiku 3.5 and Opus 4 numbers for Haiku 4.5 and Opus 4.6,
 * and priced every cache write at the 5-minute rate although the route asks for a
 * 1-hour TTL. A model with no verified price now returns null, so telemetry leaves
 * `cost_usd` out instead of inventing a figure.
 */

export type TokenPrice = {
  input: number;
  output: number;
  cacheRead: number;
  /** 5-minute-TTL cache write. */
  cacheWrite5m: number;
  /** 1-hour-TTL cache write. */
  cacheWrite1h: number;
};

/** The usage block captured per attempt (snake_case, as the SDK sends it). */
export type UsageTokens = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/**
 * The TTL the chat route asks for on the cached corpus block. The route builds
 * `cache_control` from this constant and `costUsd` prices cache writes from it, so a
 * change to the request cannot leave the price on the wrong rate. The usage block
 * reports cache writes as one total, not split by TTL, which is why a single TTL is
 * assumed here.
 */
export const CACHE_WRITE_TTL: "5m" | "1h" = "1h";

const PRICES: Record<string, TokenPrice> = {
  // Global profile: Global rate.
  "global.anthropic.claude-sonnet-5-5": {
    input: 2.0,
    output: 10.0,
    cacheRead: 0.2,
    cacheWrite5m: 2.5,
    cacheWrite1h: 4.0,
  },
  // `us.` profiles: Regional CRIS rate.
  "us.anthropic.claude-sonnet-5": {
    input: 2.2,
    output: 11.0,
    cacheRead: 0.22,
    cacheWrite5m: 2.75,
    cacheWrite1h: 4.4,
  },
  "us.anthropic.claude-sonnet-4-6": {
    input: 3.3,
    output: 16.5,
    cacheRead: 0.33,
    cacheWrite5m: 4.125,
    cacheWrite1h: 6.6,
  },
  "us.anthropic.claude-opus-4-6-v1": {
    input: 5.5,
    output: 27.5,
    cacheRead: 0.55,
    cacheWrite5m: 6.875,
    cacheWrite1h: 11.0,
  },
  "us.anthropic.claude-haiku-4-5-20251001-v1:0": {
    input: 1.1,
    output: 5.5,
    cacheRead: 0.11,
    cacheWrite5m: 1.375,
    cacheWrite1h: 2.2,
  },
};

/** The verified price row for a model id, or null when there is none. */
export function priceFor(model: string): TokenPrice | null {
  return Object.hasOwn(PRICES, model) ? PRICES[model] : null;
}

/**
 * Dollar cost of one attempt's usage, or null when the model has no verified price
 * (the direct-API ids are not on the Bedrock price list, so a direct-API deployment
 * records no cost rather than a wrong one).
 */
export function costUsd(model: string, usage: UsageTokens): number | null {
  const price = priceFor(model);
  if (!price) return null;
  const cacheWrite =
    CACHE_WRITE_TTL === "1h" ? price.cacheWrite1h : price.cacheWrite5m;
  return (
    ((usage.input_tokens ?? 0) * price.input +
      (usage.output_tokens ?? 0) * price.output +
      (usage.cache_creation_input_tokens ?? 0) * cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead) /
    1_000_000
  );
}

/**
 * Input cost a cache READ avoided for one attempt: the cache-read tokens priced at the
 * model's full input rate, minus what they cost as cache reads. Gross: it does not net off
 * the premium a cache WRITE pays over plain input (that is visible as the cache-write
 * token column). null when the model has no verified price, so the dashboard adds nothing
 * for it rather than a figure at some other model's rate.
 */
export function cacheReadSavingsUsd(
  model: string,
  usage: UsageTokens,
): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return (
    ((usage.cache_read_input_tokens ?? 0) * (price.input - price.cacheRead)) /
    1_000_000
  );
}
