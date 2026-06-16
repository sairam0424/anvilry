import { describe, expect, it } from "vitest";
import { getLlmSdkMode, LLM_SDK_MODE } from "./llm-sdk-mode";

/**
 * The SDK-mode flag is read once at module load (NEXT_PUBLIC_ inlining), so
 * this is a one-shot smoke test: in vitest the env var is unset by default →
 * anthropic-bedrock is the resolved default. The "aws-sdk-bedrock" branch
 * (and its fall-through warning) is exercised in the /api/chat integration
 * tests once Phase 2.1 wires the actual call site, where the flag value is
 * mocked at the import site.
 */

describe("llm-sdk-mode default", () => {
  it("defaults to anthropic-bedrock when NEXT_PUBLIC_LLM_SDK is unset", () => {
    expect(getLlmSdkMode()).toBe("anthropic-bedrock");
    expect(LLM_SDK_MODE).toBe("anthropic-bedrock");
  });

  it("getLlmSdkMode and LLM_SDK_MODE always agree", () => {
    expect(getLlmSdkMode()).toBe(LLM_SDK_MODE);
  });

  it("returns a value typed as LlmSdkMode (one of the two known modes)", () => {
    const mode = getLlmSdkMode();
    expect(["anthropic-bedrock", "aws-sdk-bedrock"]).toContain(mode);
  });

  it("resolved mode is stable across calls (read-once semantics)", () => {
    const a = getLlmSdkMode();
    const b = getLlmSdkMode();
    expect(a).toBe(b);
  });

  it("the default is anthropic-bedrock — the v1.6+ shipping path", () => {
    // Guard against an accidental flip of DEFAULT_MODE in the source. The
    // aws-sdk branch is not yet wired and must NOT become the default until
    // the Phase 2.1 streamWithFallback rewrite lands.
    expect(LLM_SDK_MODE).toBe("anthropic-bedrock");
  });
});
