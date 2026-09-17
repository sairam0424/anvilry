import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * faq-embeddings.ts tests (Phase 2b, optional semantic-match tier).
 * `cosineSimilarity` is pure — no mocking needed. `embedText` mocks
 * @aws-sdk/client-bedrock-runtime the same way llm.test.ts mocks
 * @anthropic-ai/bedrock-sdk: a fake class swapped in via vi.mock, with
 * `.send()` resolving a fixture response body.
 */

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  class FakeBedrockRuntimeClient {
    send = sendMock;
  }
  class FakeInvokeModelCommand {
    constructor(public input: unknown) {}
  }
  return {
    BedrockRuntimeClient: FakeBedrockRuntimeClient,
    InvokeModelCommand: FakeInvokeModelCommand,
  };
});

beforeEach(() => {
  process.env.BEDROCK_ACCESS_KEY_ID = "AKIAFAKE";
  process.env.BEDROCK_SECRET_ACCESS_KEY = "fake";
  process.env.BEDROCK_REGION = "us-east-1";
  sendMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function fixtureResponse(embedding: number[]) {
  return { body: new TextEncoder().encode(JSON.stringify({ embedding })) };
}

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", async () => {
    const { cosineSimilarity } = await import("./faq-embeddings");
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", async () => {
    const { cosineSimilarity } = await import("./faq-embeddings");
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for mismatched lengths (defensive)", async () => {
    const { cosineSimilarity } = await import("./faq-embeddings");
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors", async () => {
    const { cosineSimilarity } = await import("./faq-embeddings");
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe("embedText", () => {
  it("returns the embedding vector on a successful InvokeModel call", async () => {
    sendMock.mockResolvedValueOnce(fixtureResponse([0.1, 0.2, 0.3]));
    const { embedText } = await import("./faq-embeddings");
    await expect(embedText("what is pensieve")).resolves.toEqual([
      0.1, 0.2, 0.3,
    ]);
  });

  it("returns null (never throws) when the Bedrock call fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("throttled"));
    const { embedText } = await import("./faq-embeddings");
    await expect(embedText("what is pensieve")).resolves.toBeNull();
  });

  it("returns null when Bedrock credentials are unset", async () => {
    delete process.env.BEDROCK_ACCESS_KEY_ID;
    delete process.env.BEDROCK_SECRET_ACCESS_KEY;
    const { embedText } = await import("./faq-embeddings");
    await expect(embedText("what is pensieve")).resolves.toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns null when the response body has no embedding field", async () => {
    sendMock.mockResolvedValueOnce({
      body: new TextEncoder().encode(JSON.stringify({})),
    });
    const { embedText } = await import("./faq-embeddings");
    await expect(embedText("what is pensieve")).resolves.toBeNull();
  });
});
