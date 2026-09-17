import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { bedrockCreds } from "@/lib/llm";

/**
 * Phase 2b — optional semantic-match tier for the FAQ cache. Only ever loaded
 * via chat-cache.ts's dynamic `import()`, so this module's AWS SDK dependency
 * and every network call in it are paid ONLY when FAQ_CACHE_SEMANTIC_MATCH=true.
 *
 * Uses the raw Bedrock Runtime InvokeModel API directly — NOT `makeClient()`
 * from llm.ts, which constructs an AnthropicBedrock client shaped for the
 * Anthropic Messages API and has no path to a non-Anthropic Bedrock model like
 * Titan. Reuses `bedrockCreds()` (the same decoded-credential resolver
 * llm.ts/tts already share) so this stays the same AWS account, no new
 * credential path.
 */

const EMBED_MODEL_ID = "amazon.titan-embed-text-v2:0";
const EMBED_DIMENSIONS = 512;

/** The AWS SDK v3's NodeHttpHandler defaults requestTimeout to 0 (disabled) —
 *  without an explicit bound, a slow/hung Bedrock response could consume the
 *  chat route's entire maxDuration (30s) budget. This tier is a bonus over
 *  the base exact-match cache, never a blocker, so it gets its own tight cap
 *  well under that budget. */
const EMBED_TIMEOUT_MS = 5_000;

/** Returns `null` (never throws) on any failure — the semantic tier is a
 *  bonus, never a blocker for the base exact-match cache. */
export async function embedText(text: string): Promise<number[] | null> {
  try {
    const { accessKeyId, secretAccessKey, sessionToken, region } =
      bedrockCreds();
    if (!accessKeyId || !secretAccessKey) return null;

    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });

    const res = await client.send(
      new InvokeModelCommand({
        modelId: EMBED_MODEL_ID,
        contentType: "application/json",
        body: JSON.stringify({
          inputText: text,
          dimensions: EMBED_DIMENSIONS,
          normalize: true,
        }),
      }),
      { abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS) },
    );

    const parsed = JSON.parse(new TextDecoder().decode(res.body)) as {
      embedding?: number[];
    };
    return parsed.embedding ?? null;
  } catch {
    return null;
  }
}

/** Pure function, no I/O. Orthogonal vectors -> 0, identical vectors -> 1,
 *  mismatched lengths -> 0 (defensive — should never happen in practice since
 *  every stored embedding comes from the same model/dimension config). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
