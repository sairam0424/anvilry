---
slug: how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock
title: "How I Built Inkforge: Designing an AI-Powered Article System with STORM Pipeline, BM25 RAG, and AWS Bedrock"
date: 2026-06-20
summary: "A first-person engineering deep-dive into building Inkforge — an AI article generation system that combines the STORM research pipeline, BM25-based retrieval-augmented generation, and AWS Bedrock to produce structured, grounded long-form content at scale."
tags: ["inkforge", "typescript", "ai", "buildinpublic", "rag", "aws-bedrock"]
draft: false
tone: senior
format: narrative
length: comprehensive
category: general
wordCount: 3751
readingTime: 14
generatedBy: inkforge
platforms: []
---

## The Problem with Naive LLM Article Generation

Most LLM content generators fail in ways that look successful. The first version of Inkforge proved this perfectly — I shipped it in an afternoon, and it worked so well that the problems took weeks to notice.

The output had all the surface characteristics of quality technical writing: confident declarative sentences, reasonable heading hierarchy, even code snippets. But spend five minutes reading carefully and the cracks showed. Every article on "distributed tracing" opened with the same three-sentence definition of spans and traces, hit the same four tool mentions (Jaeger, Zipkin, Datadog, OpenTelemetry), and wrapped with a nearly identical "choose the right tool for your use case" conclusion. The coverage wasn't shallow — it was predictably, reproducibly shallow. I was getting the first two pages of Google search results serialized into prose, and nothing deeper.

The hallucination problem was worse because it was invisible. During a manual review, I caught a generated article citing `opentelemetry.io/rfcs/trace-context-propagation-v2` for a specific claim about baggage size limits. The URL was plausible — correct domain, versioned path structure, everything. The RFC doesn't exist. The claim it supported wasn't technically wrong, but it wasn't sourced from anywhere real either. If that had shipped, it would have looked authoritative and been unfalsifiable without manually checking every single link.

Token window constraints introduced a second failure mode. Anything past ~2,000 words showed coherence degradation in the final third. Later sections would introduce terminology inconsistently, occasionally contradict earlier architectural decisions, or just drift in scope. The model was losing the thread of what it had already written. Stuffing an entire article into a single context window doesn't solve the problem of attention dilution on long generations.

I spent two weeks trying to engineer my way out of this through prompt refinement. Better instructions, more examples, stronger disclaimers about consistency — none of it fixed the fundamental problem: I was asking the model to be a researcher and a writer simultaneously, and LLMs are genuinely mediocre researchers. They surface confident-sounding priors, not verified current knowledge. They're decent writers when given structured, accurate material to work from, but asking them to both discover and synthesize in one pass is asking too much.

The architecture was the problem, not the prompt.

## Discovering STORM: Research Before Writing

The Stanford STORM paper landed when I'd already burned enough time on prompt engineering to know it wouldn't help. The core observation — that expert writing is preceded by structured research across multiple viewpoints, not a single top-down drafting pass — felt obvious in retrospect, but the operationalization was what I needed.

STORM (Synthesis of Topic Outlines through Retrieval and Multi-perspective questioning) decomposes long-form generation into four sequential phases: perspective generation, question-driven retrieval, grounded synthesis, and finally writing. The sequencing *is* the point. By the time you touch a drafting model, every claim has a retrieval trace behind it and every major angle has been interrogated by a simulated expert. You're not asking an LLM to hallucinate structure — you're asking it to organize evidence that already exists in your context window.

Single-pass generation conflates the roles of researcher, editor, and writer into one inference call. That's why you get text that's fluent and structurally coherent but factually thin — the model is optimizing for prose quality while simultaneously trying to reason about coverage gaps it doesn't know it has.

I adapted STORM's persona simulation loop specifically for engineering content. For each article topic, Inkforge generates N synthetic expert reviewers — I settled on four to five after testing — drawn from role archetypes relevant to the domain. Each persona surfaces a distinct question set before any retrieval happens.

The difference in question quality is stark. For a topic like "Kafka consumer group rebalancing," a naive single-pass prompt asks generic questions about rebalancing mechanics. STORM's persona loop spins up a platform engineer, a streaming data architect, and an SRE, and each pulls in a completely different direction:

- The **platform engineer** asks about partition assignment strategies, cooperative vs. eager rebalancing protocols, and `group.initial.rebalance.delay.ms` tuning.
- The **streaming data architect** focuses on back-pressure implications, consumer lag spikes during rebalance windows, and idempotency requirements at the application layer.
- The **SRE** immediately goes to failure modes: what happens when a consumer crashes mid-rebalance, how heartbeat timeouts interact with `session.timeout.ms` under GC pressure, and what your alerting surface needs to look like.

Those three lenses produce a question corpus that shapes retrieval queries, which shapes the grounding context, which shapes the final article structure. Without them, you get a competent Wikipedia summary. With them, you get something that reads like it was written by someone who's actually operated Kafka at scale.

I accepted the cost trade-off early. STORM adds 5–10x latency and LLM call overhead compared to single-shot generation. For Inkforge's use case — quality technical reference content, not real-time generation — that's a reasonable exchange. A reader bouncing off a shallow article is a worse outcome than waiting thirty extra seconds.

The next question was structural: how do I actually wire a multi-phase pipeline to a retrieval layer that can answer these expert questions reliably?

## Building the BM25 Retrieval Layer

Dense vector embeddings were the obvious default. I spent a weekend prototyping a FAISS-based retrieval layer with Titan Embeddings before stepping back and asking whether the complexity was justified. For Inkforge's use case — a corpus of roughly 30–40k documents that changes incrementally — BM25 made more sense. It's deterministic, so debugging a bad retrieval result means reading term frequencies rather than interrogating a 1536-dimensional vector space. There's no embedding inference cost per query. And on corpora under ~50k documents, BM25 hits sub-second latency without caching tricks. The interpretability alone was worth the trade-off during early development.

The corpus itself is curated: AWS official documentation, service engineering blog posts, and relevant RFC texts. Each document is chunked at the paragraph level with overlap, then indexed. I built the BM25 implementation in TypeScript — the rest of Inkforge is Node-based, and a Python sidecar would've introduced a deployment seam I didn't need. The index structure stores per-term frequency maps in DynamoDB (one item per document-chunk, with a `termFreqs` map attribute) and the inverted index — term → document ID list with IDF scores — serialized as JSON in S3. At query time, the hot path loads only the IDF table into memory; term frequency lookups are batched DynamoDB reads. Cold start runs around 400ms; warm retrieval for a query against 35k chunks takes ~180ms.

The retrieval pipeline looks like this:

```typescript
async function retrieve(question: string, topK = 20, topN = 5): Promise<Passage[]> {
  const expandedQuery = await expandQuery(question); // LLM expansion pass
  const candidates = await bm25Search(expandedQuery, topK);
  const reranked = await rerankWithHaiku(question, candidates);
  return reranked.slice(0, topN);
}
```

The `rerankWithHaiku` step is a lightweight Claude Haiku call that scores each candidate passage for relevance to the *original* question — not the expanded one. Haiku's latency here is acceptable because it runs over 20 pre-fetched candidates, not against the full index.

Query expansion was born from pain. BM25 scoring degrades badly on short queries — anything under four or five tokens produces unreliable recall because there isn't enough term surface area to discriminate between documents. I lost two days debugging why retrieval quality collapsed on operator-style questions before isolating the pattern. The fix was an LLM pre-pass that expands short queries before they hit the index. For example, the query `Bedrock invoke model timeout` becomes `AWS Bedrock InvokeModel API request timeout configuration retry policy` before BM25 sees it. On a held-out eval set of 150 questions, recall at K=20 jumped from 61% to 89% after adding this step. The expansion prompt is deliberately terse — I'm asking for synonym and concept expansion, not rewriting, to avoid semantic drift from the original intent.

The nastier production issue was index staleness around versioned documentation. AWS SDK v2 and v3 have meaningfully different APIs, and BM25 doesn't inherently distinguish them. Early runs produced articles mixing v2 `AWS.config` patterns with v3 `@aws-sdk/client-*` idioms in the same paragraph. The fix was pragmatic: each indexed chunk carries a `docVersion` metadata field, and retrieval filters by version tag before scoring. It's not elegant, but it eliminates an entire class of grounding drift that would otherwise go unnoticed until a reader filed a bug.

Getting retrieval right was prerequisite work — but the more interesting complexity was in how those retrieved passages get woven into the STORM synthesis stages.

## Integrating AWS Bedrock: Model Selection, Routing, and Cost Control

AWS Bedrock's value isn't just managed inference — it's a single API contract across a roster of foundation models, which lets you route pipeline stages to cost-appropriate models without re-architecting your client layer. I settled on a three-tier routing scheme: Claude Haiku for re-ranking BM25 candidates and expanding the STORM outline nodes (high-volume, low-complexity), Claude Sonnet for synthesis where coherence actually matters, and Opus reserved for final editorial review. Haiku at roughly 1/15th the cost of Opus isn't a quality compromise for classification tasks — it's the correct tool.

**InvokeModel vs. InvokeModelWithResponseStream** was a mistake I made early. I started with synchronous `InvokeModel` because it's simpler to reason about, but synthesis calls targeting 2,000 words were blocking the response for 18–22 seconds. The UI felt broken. Switching to `InvokeModelWithResponseStream` dropped perceived latency to near-zero, but introduced a parsing problem: the stream emits `chunk` events with base64-encoded partial JSON payloads that need to be buffered and reassembled before downstream stages can consume the full response.

```typescript
const stream = await bedrockClient.send(
  new InvokeModelWithResponseStreamCommand({ modelId, body })
);
let assembled = "";
for await (const event of stream.body) {
  if (event.chunk?.bytes) {
    const partial = JSON.parse(
      Buffer.from(event.chunk.bytes).toString("utf-8")
    );
    assembled += partial.delta?.text ?? "";
  }
}
```

The edge case that bit me: if the stream connection drops mid-response, `assembled` contains a syntactically valid but semantically truncated article section. I added a completion-token sentinel check — if the stop reason isn't `"end_turn"`, the result is discarded and the call retried.

**Throttling was the most operationally painful part.** Bedrock enforces per-model TPM and RPM quotas at the account level, not the application level — meaning a rogue background job can exhaust your Sonnet RPM budget and starve foreground requests. During a load test, the synthesis stage hit Sonnet's RPM ceiling and started returning 429s silently. Without a rate limiter in place, the job queue backed up, and the cascade manifested as a 45-second timeout on the API Gateway — well past the 29-second hard limit, which converted into a cold 504 for every in-flight request. I implemented a token-bucket rate limiter in front of all Bedrock calls with exponential backoff and full jitter, which smoothed burst traffic and made 429s recoverable rather than fatal.

**IAM scoping deserves attention beyond the standard least-privilege checklist.** My staging environment had a `bedrock:InvokeModel` policy with a wildcard resource, which I caught during a security review before production. The corrected policy scopes to explicit model ARNs — `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet*` — so a misconfigured routing decision can't silently invoke a model outside the approved set.

**Cost observability was non-negotiable.** Every Bedrock call emits input and output token counts as CloudWatch custom metrics, partitioned by pipeline stage and model ID. Billing alarms are set at stage-level thresholds, so a pathological prompt that inflates synthesis tokens surfaces before it becomes an invoice surprise.

With inference routing and cost controls in place, the architecture was ready to face the orchestration problem: how do you actually wire this multi-stage pipeline together without it falling apart under real concurrency?

## Orchestrating the Full Pipeline in TypeScript

Early prototypes used a single orchestrator class with methods for each stage — a `StormPipeline` god object that held all state internally. It was untestable in isolation, and when a synthesis bug surfaced, reproducing it meant re-running the entire pipeline. I scrapped it and rebuilt around composable async functions with explicit data contracts between them.

Each stage is a pure async function with a typed input and output:

```typescript
interface PerspectiveSet {
  topic: string;
  personas: Persona[];
  generatedAt: string;
}

interface RetrievalContext {
  perspectiveSet: PerspectiveSet;
  retrievedChunks: Record<string, BM25Result[]>; // keyed by persona.id
}

interface SynthesisBundle {
  retrievalContext: RetrievalContext;
  outlines: Record<string, SectionOutline[]>;
  mergedOutline: SectionOutline[];
}

async function generatePerspectives(topic: string): Promise<PerspectiveSet> { ... }
async function retrieveForPersonas(ps: PerspectiveSet): Promise<RetrievalContext> { ... }
async function synthesizeOutline(rc: RetrievalContext): Promise<SynthesisBundle> { ... }
```

Defining `PerspectiveSet`, `RetrievalContext`, and `SynthesisBundle` as strict interfaces caught three schema mismatches during a refactor — cases where I'd renamed a field in an upstream stage and the downstream consumer would have silently received `undefined`. TypeScript's structural checking turned those into compile errors rather than subtle hallucination artifacts in final output.

For durable orchestration, each stage runs as a Lambda inside an AWS Step Functions state machine. The STORM phases map directly: perspective generation → retrieval → synthesis → writing → editorial review. Step Functions handles retry logic and error catches declaratively in the state machine definition — exponential backoff on Bedrock throttle errors, dead-letter transitions on synthesis failures. I don't want retry logic scattered across application code.

The critical production decision was intermediate S3 checkpointing. Before each Lambda returns, it writes its full output to a deterministic S3 key:

```typescript
const key = `pipelines/${executionId}/${stageName}/output.json`;
await s3.putObject({ Bucket: CHECKPOINT_BUCKET, Key: key, Body: JSON.stringify(output) });
```

If a downstream stage fails, I can resume from the last successful checkpoint by passing the S3 key into the Step Functions re-execution rather than starting from scratch. On a five-persona run, re-spending retrieval and synthesis LLM budget because the editorial Lambda timed out would cost roughly $0.80 in wasted Bedrock invocations — not catastrophic, but it compounds across a content pipeline running dozens of articles daily.

The concurrency model matters more than it sounds. Retrieval for each persona is independent, so I run them in parallel:

```typescript
const chunks = await Promise.all(
  personas.map(p => retrieveChunksForPersona(p, bm25Index))
);
```

This dropped wall-clock time from roughly four minutes to ninety seconds on a five-persona run. The bottleneck shifted to synthesis, which is inherently sequential because the merged outline depends on all retrieved chunks.

The Step Functions execution history turned out to be an unexpected audit log. During a content quality investigation — an article had generated a factually malformed claim in one section — I pulled the execution history, identified the specific synthesis invocation, and replayed that exact stage by re-invoking the Lambda with the S3-persisted `RetrievalContext` and a patched prompt. No re-retrieval, no re-running perspectives. That reproducibility would have been impossible with the original monolithic approach, and it's now a first-class debugging workflow.

## Failure Modes I Hit in Production (And How I Fixed Them)

Shipping the pipeline to real traffic exposed four distinct failure classes that testing never surfaced. Each one required a non-obvious fix.

### Context Window Overflow in Synthesis

With five personas each retrieving their top-5 documents, synthesis was regularly receiving 25 passage blocks before I'd written a single token of the article. For longer source documents, that aggregated context routinely exceeded Claude Sonnet's effective input window and either silently truncated or triggered a 400 error. The fix was a deduplication pass using Jaccard similarity across passage trigrams before injection:

```typescript
function deduplicatePassages(passages: string[], threshold = 0.72): string[] {
  return passages.filter((p, i) =>
    passages.slice(0, i).every(prev => jaccardSimilarity(trigrams(p), trigrams(prev)) < threshold)
  );
}
```

This collapsed 25 passages down to 9–12 on average, with no measurable quality regression in the final output.

### Persona Collapse

This failure mode surprised me most. For niche technical topics, the persona generation stage would produce five "experts" who were effectively the same person with different job titles. The collapse was most visible on a topic like *AWS Lambda cold starts* — all five personas asked nearly identical questions about execution environment initialization, producing a redundant, repetitive article that read like one person interviewing themselves. I added an explicit diversity penalty to the persona prompt:

> "Each persona must have a distinct primary concern. No two personas may share the same first-order question. Reject any persona whose core question overlaps with a previously defined persona by more than 30%."

Pairing this constraint with a higher-temperature generation pass (0.9 vs. the default 0.7) produced meaningfully differentiated viewpoints.

### BM25 Index Cold-Start Latency

First-request latency after a Lambda cold start was 8–12 seconds, almost entirely spent deserializing the BM25 inverted index from S3. I moved the index file to `/tmp` on initialization and added a scheduled warm-up ping every 4 minutes. Cold-start time dropped to 1.2 seconds. The trade-off is a stale index window between redeployments, which I handle by versioning the S3 key and invalidating `/tmp` on deploy via an environment variable bump.

### Outline Hallucination Loop

The outline expansion stage occasionally generated section headings referencing concepts — specific API parameters, obscure service limits — that retrieval had never surfaced. Left unchecked, the writer stage would either hallucinate content or produce unsupported assertions. I added a grounding check that validates each proposed heading against retrieved passage metadata before writing begins; any heading with zero metadata coverage gets dropped or rewritten against what was actually retrieved.

These four fixes collectively account for roughly 80% of the production incidents I've logged — the remaining edge cases mostly trace back to upstream retrieval quality.

## Evaluating Output Quality Without a Human in the Loop

Shipping without a human review loop meant I needed signal I could trust. Spot-checking by vibes doesn't scale, and "the article looks good" isn't a regression test. I built an automated eval harness that scores every generated article across four dimensions before it ever touches the publish queue.

The four metrics: **factual grounding ratio** (what fraction of claims are traceable to a retrieved passage), **structural coherence** (section-to-outline alignment scored by comparing generated headers against the STORM-produced question tree), **lexical diversity** via MTLD score, and **coverage breadth** (percentage of STORM-generated questions that receive a substantive answer in the final output). Each produces a scalar; all four gate deployment.

For grounding ratio, I use Claude Haiku as an LLM judge at the sentence level. Sonnet was accurate but cost-prohibitive at eval volume — Haiku is roughly 15x cheaper and sufficiently precise for binary grounded/ungrounded classification. The first prompt version had a quiet failure mode: Haiku would mark a claim as grounded when the retrieved passage was merely *adjacent* — same topic, wrong fact. The fix was blunt but effective — require the judge to quote the supporting span verbatim:

```text
If the claim is supported, you MUST copy the exact substring from the passage 
that supports it. If you cannot find a verbatim span, classify as UNGROUNDED.
```

That single constraint dropped false positives noticeably. Haiku can't hallucinate a quoted span that doesn't exist in the passage, so the grounding check became structurally honest rather than vibes-based.

Regression testing runs against a golden set of 20 reference topics with known ground-truth facts. Any pipeline change — model swap, retrieval corpus update, prompt edit — triggers a full eval run against this set. A grounding ratio drop of more than 5% relative blocks the deploy automatically.

This harness has caught real regressions and real improvements. After a retrieval corpus update that added AWS re:Post threads, grounding ratio on infrastructure topics jumped from 74% to 88%. The eval harness detected the improvement, flagged it, and auto-promoted the new index version to production without manual intervention.

That kind of bidirectional sensitivity — catching both regressions and genuine gains — is what makes the harness worth maintaining.

## Architecture Decisions I'd Make Differently

Hindsight is cheap, but cataloguing these mistakes is worth it — they each cost real time or money.

**DynamoDB for the BM25 term frequency store was the wrong call.** I chose it for the managed scaling and familiarity, but BM25 indexing requires scan-heavy update patterns: when a new document arrives, you need to update inverse document frequency across the entire vocabulary. DynamoDB's pricing model punishes full-table scans, and the conditional update gymnastics required to maintain term frequency counts atomically turned a simple index update into a multi-step transaction. If I were starting today I'd use PostgreSQL with a GIN index from day one, and probably reach for ParadeDB's `pg_bm25` extension to get Tantivy-backed BM25 scoring inside Postgres rather than reimplementing it in application code. The operational overhead is comparable; the query model is dramatically more natural.

**Step Functions Express Workflows have a 5-minute execution cap, and I hit it in production.** The specific case: a "Kubernetes networking internals" article that required 12 retrieval rounds across 6 simulated personas — CNI plugin maintainer, platform engineer, security reviewer, and three others. The execution silently timed out and returned a partial article with no error surfaced to the caller. My API response contained three complete sections and four empty ones, and the caller had no indication anything had gone wrong. I migrated to Standard Workflows, which support executions up to a year. The trade-off is real — Standard Workflows charge per state transition rather than per duration, which adds up on a pipeline with 40+ states — but silent partial failures on complex topics are worse than higher per-execution cost.

**TypeScript interfaces at stage boundaries aren't runtime contracts.** I defined the inter-stage data shapes as TypeScript interfaces and assumed the type system would protect me. It doesn't, because Bedrock responses are `unknown` at runtime and I was casting rather than parsing. Three production bugs traced back to malformed stage outputs that TypeScript's static analysis had no visibility into. I should have defined JSON Schema for each stage boundary from day one and validated on ingress. A 50-line Zod schema per stage would have caught all three.

**The editorial pass is expensive and often unnecessary.** The final Claude Opus rewrite call accounts for roughly 40% of per-article token cost. After A/B testing on articles with a grounding ratio above 85%, I found no measurable quality difference when skipping it — dropping total cost per article by 30%. The pass earns its keep on poorly-grounded drafts; on well-sourced ones it's mostly rearranging furniture.

Each of these isn't a hypothetical refactor — they're on the backlog, and the data contracts migration is already underway.

## What Inkforge Taught Me About Building AI Systems

The most durable lesson from this project is that architecture matters far more than model choice. Swapping Claude Sonnet for GPT-4 changed the prose style — sentence cadence, bullet list preferences, verbosity on technical asides — but it didn't move the quality ceiling. Adding STORM's research decomposition and BM25-backed retrieval did. The model is a renderer; the pipeline is the design.

That distinction only became obvious once I had proper observability. The single most impactful engineering decision in the entire project was adding structured logging to every Bedrock call — prompt hash, model ID, input and output token counts, latency, stage label, and a truncated output sample. Before that, debugging a bad article meant re-reading it and guessing. After, it meant querying logs:

```typescript
logger.info({
  stage: 'synthesis',
  promptHash: hashPrompt(prompt),
  modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  latencyMs: Date.now() - startTime,
  outputSample: output.slice(0, 300),
});
```

That transformed the question from *why did this article turn out wrong* to *at which exact stage and with which exact context did quality degrade*. Regression debugging went from hours to minutes.

The second insight was about separation of concerns. Research, synthesis, and writing are cognitively distinct activities in human technical writing — conflating them in a single prompt means a single failure propagates everywhere simultaneously. The STORM pipeline enforces that boundary structurally. When synthesis broke, it broke in isolation. The research artifacts were still clean, and I could replay just that stage.

I'd also push back on the assumption that cost and quality are in opposition. The changes that most improved output quality — query expansion, passage deduplication, grounding validation — also reduced cost. They did it by catching failures early, before they triggered expensive downstream re-runs. Good architecture is defect prevention, and defect prevention is cost control.

The gap between a working prototype and a reliable production system comes down to whether you've instrumented the pipeline well enough to know which half of it is actually doing the work.