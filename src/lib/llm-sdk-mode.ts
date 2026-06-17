/**
 * Build-time flag selecting the underlying SDK for /api/chat.
 *
 * NEXT_PUBLIC_LLM_SDK = "anthropic-bedrock" | "aws-sdk-bedrock"
 *   "anthropic-bedrock" (DEFAULT) — uses @anthropic-ai/bedrock-sdk, the v1.6+
 *      shipping path. Streaming + tool-use shape is well-trodden here and the
 *      streamWithFallback machinery in src/lib/llm.ts is built around it.
 *   "aws-sdk-bedrock" — would use @aws-sdk/client-bedrock-runtime. Its OTel
 *      auto-instrumentation works out of the box (the whole reason this flag
 *      exists), but the streaming + tool-use shape is different enough that
 *      streamWithFallback needs a rewrite — it's not a drop-in.
 *
 * v1.8 ships ONLY the flag; the aws-sdk branch is wired in a v1.8.x follow-up
 * gated by this flag. Today, "aws-sdk-bedrock" logs a warning and falls through
 * to the anthropic-bedrock path so nothing breaks if someone flips it early.
 *
 * Read once at module load (NEXT_PUBLIC_ is inlined at build time). A redeploy
 * is needed to switch SDKs — same constraint as every other Anvilry env flag
 * (see voice-picker-mode.ts, enabled-views.ts).
 */

export type LlmSdkMode = "anthropic-bedrock" | "aws-sdk-bedrock";

const DEFAULT_MODE: LlmSdkMode = "anthropic-bedrock";

const raw = process.env.NEXT_PUBLIC_LLM_SDK;

const resolvedMode: LlmSdkMode =
  raw === "aws-sdk-bedrock" || raw === "anthropic-bedrock" ? raw : DEFAULT_MODE;

/** The active SDK mode for this build. /api/chat reads this to decide which
 *  Bedrock client to instantiate; everything upstream (prompt, tools, rate
 *  limit, telemetry sink) is mode-agnostic. */
export function getLlmSdkMode(): LlmSdkMode {
  return resolvedMode;
}

/** Convenience for inline conditionals at call sites. Mirrors the
 *  voice-picker-mode convention even though /api/chat is server-only. */
export const LLM_SDK_MODE: LlmSdkMode = resolvedMode;
