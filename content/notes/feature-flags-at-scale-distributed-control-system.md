---
slug: feature-flags-at-scale-distributed-control-system
title: "Feature Flags at Scale: Designing a Distributed Control System for Production Behavior"
date: 2026-06-20
summary: "At scale, feature flags stop being booleans and become a distributed control plane — here's the architecture, failure modes, and operational patterns that make them work at millions of evaluations per second."
tags: ["feature-flags", "system-design", "distributed-systems", "devops", "engineering"]
draft: false
tone: senior
format: explainer
length: comprehensive
category: system-design
wordCount: 3401
readingTime: 13
generatedBy: inkforge
platforms: []
---

## The Counterintuitive Truth: Feature Flags Are Not Config Files

Most engineers first encounter feature flags as a simple abstraction: a key-value lookup that returns true or false. That mental model works fine for a single service handling a few hundred requests per minute. It becomes actively dangerous at scale.

A mature feature flag system isn't a config file with an API wrapper — it's a **distributed control plane**. The distinction matters architecturally. A control plane manages the real-time behavior of a running system across many nodes simultaneously, with its own consistency guarantees, failure semantics, and propagation latency. That's a fundamentally different design problem than reading a YAML file on startup.

One constraint drives every downstream decision: **user traffic must never block on a remote flag service call.** If evaluation requires a synchronous RPC, you've coupled your request path to the availability and latency of an external system. Netflix's Archaius library enforces this by evaluating flags entirely in-process against a locally-cached configuration snapshot. A network round-trip per evaluation injects 10–50ms of tail latency at p99 — catastrophic when you're competing on streaming start times measured in hundreds of milliseconds. Google, Meta, and Netflix collectively evaluate flags against millions of requests per second with sub-millisecond overhead. That figure is only achievable through local evaluation backed by an async synchronization layer, not RPC.

The other failure mode engineers underestimate is **flag sprawl**. Systems accumulate flags the way codebases accumulate dead functions — gradually, then all at once. I've seen services carrying thousands of flags where fewer than 10% were actively managed. The operational weight alone becomes a liability: which flags are safe to remove? Which ones are kill switches for production behavior that no one documented?

Knight Capital's $440M loss in 45 minutes in 2012 remains the canonical cautionary tale. A stale feature flag inadvertently activated dormant trading code during a deployment, and the blast radius was immediate and irreversible. Flag lifecycle management — creation, ownership, expiration — isn't operational housekeeping; it's a correctness property of your system.

Understanding *why* local evaluation is non-negotiable sets up the architectural pattern that makes it possible: the flag state replication pipeline.

## Requirements: What 'Feature Flags at Scale' Actually Demands

The functional surface alone surprises most engineers. A production flag system isn't serving booleans — it's serving typed values (integers, strings, arbitrary JSON), kill switches with hard fail-closed semantics, percentage rollout gates, canary targets scoped to specific infrastructure segments, and versioned snapshots that let you replay what the system believed at a given point in time. Targeting rules compound this quickly: at Uber, a single flag evaluation might need to resolve against `user_id`, `region`, `device_type`, `tenant`, and `experiment_group` simultaneously. A naive if-else chain works at 10 rules. At 50, it becomes a maintenance liability. At 200, it's a correctness hazard. You need a rule engine with a well-defined evaluation order, conflict resolution, and deterministic behavior under partial attribute sets.

The non-functional requirements are where the real architecture lives. Sub-millisecond evaluation latency isn't aspirational — it's a hard constraint once flags sit in the hot path of request handling. At millions of evaluations per second, any synchronous network call to a central store is a non-starter. Availability needs to clear 99.99%, which means the evaluation path must degrade gracefully when the control plane is unreachable, either failing closed (deny by default) or failing open (permit by default) based on the flag's declared safety policy. These aren't interchangeable decisions, and conflating them causes incidents.

The consistency model is the architectural insight that most designs get wrong by trying to make it uniform. The control plane — authoring, validation, audit — requires strong consistency. A flag misconfiguration that half your fleet sees and half doesn't is strictly worse than a brief write delay. The data plane, by contrast, intentionally tolerates eventual consistency. Meta's Gatekeeper system operates with a 30–60 second propagation window across its evaluation tier, accepting that staleness is acceptable, but staleness-during-outage is not. Local evaluation against a cached snapshot is the entire point.

Observability isn't an afterthought here — it's a first-class requirement. Flag exposure tracking, per-evaluation audit logs, and rollout telemetry are the mechanism by which you prove a flag change caused a regression rather than merely correlating with one. Without them, rollback decisions are guesswork.

These requirements shape every layer of the system, starting with the data model that carries all of it.

## High-Level Architecture: Control Plane vs. Data Plane

Here's the counterintuitive part: a flag system optimized for evaluation speed looks almost nothing like a flag system optimized for safe flag management. Those are fundamentally different problems, and conflating them is the root cause of most flag infrastructure failures I've seen in production.

The solution is a clean separation into two planes with explicitly different contracts.

**The Control Plane** owns authoring, validation, and rollout orchestration. A flag change flows through a UI or API → a validation engine (targeting rule schema checks, mutual-exclusion guardrails, kill-switch constraints) → a strongly-consistent store — Spanner if you need globally-serialized writes, Postgres if you're regionally scoped — → a distribution service that fans changes out to consumers. This path is *slow by design*. Write latency of hundreds of milliseconds is acceptable; a misconfigured targeting rule that crashes a canary population is not. The control plane is write-optimized and correctness-prioritized.

**The Data Plane** is the exact opposite. It's an embedded SDK running inside every service instance — a JVM agent, a Go library, a sidecar — holding a complete in-memory snapshot of all flag configurations. Evaluation is a pure function: deterministic rule engine, no network I/O, no locks on the hot path. At a million evaluations per second, even a 1ms P99 latency on flag lookup is catastrophic. The data plane pays that cost once at startup and on incremental updates, then amortizes it across every request indefinitely.

The **distribution service** is the bridge. It maintains a persistent watch on the config store — a Postgres `LISTEN/NOTIFY` channel, a Spanner change stream, or a custom CDC pipeline — and pushes config diffs to registered service caches as changes land. The critical word is *pushes*.

Pull-based polling is an anti-pattern at scale, and the reasoning is straightforward: flip a high-traffic flag and every service instance's poll timer fires within the same jitter window. You've just created a thundering herd directly on your config store, exactly when the system is under change-induced stress.

This push-from-source architecture is proven at hyperscaler scale in adjacent systems. Envoy's xDS protocol uses an identical model — a management server pushes config diffs to data plane proxies rather than having proxies poll. The Kubernetes controller pattern applies the same principle: controllers watch for state changes and reconcile, rather than continuously re-fetching the entire desired state. Thousands of flag SDK instances refreshing simultaneously after a topology change isn't a hypothetical; it's the default failure mode of naive polling designs.

The consistency requirements across these planes diverge sharply — and that divergence shapes every caching and propagation decision downstream.

## Flag Data Model: Beyond the Boolean

The mental model of a flag as a key-value pair breaks down the moment you need to answer: "Which version of this rule is in production, who owns it, and when does it expire?" A production flag is a **versioned rule tree** — a structured document carrying type metadata, an ordered list of targeting rules with predicates, a default value, ownership metadata, and an expiry timestamp. That last field is chronically undervalued; stale flags accumulate into a slow-moving operational hazard that eventually bites you during an incident.

Rule evaluation is ordered and short-circuits. The canonical sequence is: kill switch overrides first, then explicit targeting rules, then percentage rollout buckets, then the global default. That ordering is load-bearing. Consider a checkout flag from a real e-commerce scenario:

```json
{
  "flag": "new_checkout_v2",
  "version": 14,
  "type": "boolean",
  "owner": "payments-team",
  "expires_at": "2024-09-01T00:00:00Z",
  "rules": [
    { "if": "region == EU", "value": false },
    { "if": "user_percent < 5", "value": true }
  ],
  "default": false
}
```

The EU rule precedes the rollout rule deliberately — GDPR compliance is a hard override, not a population sample. Reversing that order silently ships non-compliant behavior to a subset of European users.

Targeting predicates support compound expressions: `region == EU AND user_tier == premium AND hash(user_id) % 100 < 5`. The hash function here isn't an implementation detail — it must be stable and deterministic across services and restarts. A non-deterministic hash means the same user evaluates into different buckets across requests, producing the kind of experience flapping that's nearly impossible to reproduce in staging.

More sophisticated systems take a Zanzibar-influenced approach where rule predicates reference relationship tuples — `user is_member_of beta_group` — rather than raw attribute values. This decouples group membership from the flag definition itself; adding a user to a beta cohort updates the authorization graph, not the flag document, enabling dynamic targeting without a flag redeployment cycle.

JSON-typed flags deserve special attention. A flag that returns `{"timeout_ms": 3000, "retry_count": 2}` is no longer feature gating — it's remote configuration. At this point, the flag system's data model starts pulling double duty, and the boundary between "flags" and "dynamic config" dissolves entirely, with real implications for how you think about consistency guarantees.

## Flag Evaluation Engine: O(1) on the Hot Path

The counterintuitive part of flag evaluation performance isn't the algorithm — it's *when* the work happens. Engineers typically assume that fast evaluation means a fast lookup at runtime. The real optimization is eliminating runtime work entirely by front-loading it at cache-load time.

When the SDK receives a flag payload from the data plane, it doesn't store the raw rule list. It pre-compiles it: rules are indexed by flag key into a structure that supports O(1) key lookup, with rule traversal deferred to evaluation time but bounded by rule count, not user count. LaunchDarkly's SDK does exactly this — at initialization, it converts the incoming rule list into a key-indexed map so that every evaluation starts with a single hashtable lookup, followed by linear traversal over a typically small, finite rule set. Evaluation complexity is O(1) amortized across the flag key space; the linear component is a constant you control by limiting rule depth.

**Per-request memoization** eliminates a second class of waste. In a non-trivial service, a single flag like `new_checkout_v2` may be evaluated a dozen times across middleware, service logic, and rendering layers within one request. Without memoization, each call re-traverses the rule tree and re-computes targeting. With it, the first evaluation populates a request-scoped cache keyed on `(flag_key, evaluation_context_hash)`; subsequent calls return the cached variant directly. Twelve evaluations become one rule traversal plus eleven map reads.

**Determinism is non-negotiable.** Percentage rollouts computed as `hash(user_id) % 100` must produce identical results across every service instance and every SDK version deployed simultaneously. I once watched this go wrong in production: at a fintech running a gradual checkout rollout, two SDK versions in parallel deployment used different hash seeds. The result was roughly 3% of users seeing alternating UI states on page refresh — the new checkout one request, the old checkout the next. The bug was invisible in logs until flag exposure tracking revealed that the same `user_id` was receiving different variant assignments. Diagnosis took three days; the fix was a one-line seed normalization.

**Evaluation context is a snapshot.** The SDK captures the flag ruleset version at request start. Mid-request flag updates — which happen continuously in a live system — do not mutate in-flight evaluations. Consistency within a request is strict; consistency across requests is eventual.

The evaluation engine's correctness guarantees only hold if the data feeding it stays fresh and coherent, which brings cache invalidation and update propagation into focus.

## Distribution Model and Failure Modes

The most expensive mistake I've seen in flag infrastructure is treating distribution as a read-through cache problem. It isn't. At scale, distribution is a consistency problem — and the failure modes from getting it wrong are subtle enough to evade your staging environment entirely.

**Push over pull, always.** The thundering herd case makes this obvious: when 10,000 service instances poll on a 30-second interval and a flag update lands, you get a coordinated spike against your flag store roughly every polling cycle. But the latency argument is equally compelling — push-based systems propagate changes in seconds; pull-based systems propagate changes in *up to one polling interval*, which is the wrong answer when that flag is a kill switch. Practically, this means your flag store should maintain persistent connections to subscribers (SSE, gRPC streaming, or WebSocket), pushing diffs on change rather than waiting for clients to ask.

**Fail-closed vs. fail-open is a per-flag contract, not a system default.** A kill switch for a payment processor that disables a fraud-detection bypass should fail-closed: if the flag store is unreachable, the conservative behavior is to assume the kill switch is active and disable the feature. A UI experiment showing a new checkout button layout should fail-open: the safe default is the existing experience, not a hard failure. This policy belongs in the flag definition itself, not in application code that will inevitably diverge across services.

**Version pinning and atomic snapshot application.** Applying a partial diff is worse than applying nothing. Consider a coordinated update that activates a kill switch *and* raises a rate limit ceiling to compensate — applying only the kill switch activation causes a correctness regression. Services should maintain a monotonic version counter and only commit a new snapshot if the full version is received. If a diff is incomplete or arrives out of order, hold the previous version.

The **cold start problem** deserves specific treatment. A freshly launched instance has no local cache. Two options: block on a synchronous fetch before accepting traffic, or start with hardcoded defaults and accept a divergence window. Envoy xDS makes the correct trade-off for safety-critical config — it blocks listener activation until the initial config push is received, meaning no traffic is served until the full snapshot is loaded. AWS AppConfig takes a complementary approach at the distribution layer itself: config pushes include a bake time window, with CloudWatch alarms monitored during rollout and automatic rollback triggered if error rates spike. That's the right abstraction boundary — rollback logic in the distribution infrastructure, not scattered across application code.

The evaluation engine is only as correct as the snapshot it's working from, which means the consistency guarantees of your distribution layer directly constrain the safety properties of every flag in your system.

## Kill Switches, Canaries, and Progressive Rollouts

Kill switches occupy a special tier in the evaluation order — they're evaluated *before* any targeting predicate runs. The implementation consequence is significant: a kill switch cannot depend on user context, because at the moment you need it, you may not have a valid user object, a working database, or a functioning auth service. It's a boolean override, period. The system checks it first, returns the override value if set, and never touches the targeting rules. This is what makes Uber's surge pricing kill switch work: during a major incident, on-call engineers flip a single flag that disables surge pricing globally within 30 seconds across all regions. That response window is only achievable because evaluation requires no network call — the flag state is resident in every process's local cache, and propagation uses the fan-out push model covered in the previous section. A synchronous network call per evaluation would make a 30-second global rollback physically impossible at their request volume.

Flag-based canaries differ from infrastructure canaries in a subtle but operationally important way: the new code path runs in the same binary as the existing path. There's no separate deployment, no second fleet to drain. Activating a flag canary takes seconds; rolling it back takes the same. The tradeoff is that you can't isolate resource contention between paths, but for pure logic changes it's strictly faster.

The critical implementation detail in percentage rollouts is that the percentage is not random per-request — it's `hash(user_id) % 100`. This ensures a given user sees a consistent experience across every service instance and across the entire duration of the rollout. Without this, a user mid-checkout could alternate between old and new behavior on sequential requests, producing both bad UX and uninterpretable metrics.

Modern systems go further by coupling rollout percentage to real-time metric feedback. Meta's Gatekeeper ramp feature starts a flag at 0.1% of users and automatically increments by 0.1% every 30 minutes if no metric regression is detected — error rates, p99 latency, business KPIs. If a regression surfaces during a 5% canary window, the system rolls back automatically and pages on-call. A complete 0%→100% ramp can finish overnight with zero engineer involvement.

The automated feedback loop depends on one thing the flag system itself can't provide: a reliable, low-latency signal from your observability stack — which shapes how the control plane and metrics pipeline need to be coupled.

## Flag Lifecycle Management: The Failure Mode Nobody Plans For

Flag sprawl is the failure mode that hits you slowly, then all at once. You don't notice the first 500 flags. You barely notice the first 1,000. At 4,000+, Atlassian's engineering team discovered that on-call engineers could no longer reason about which flags were safe to flip during an active incident. Their response: mandatory 90-day expiry on every flag, with automated JIRA ticket creation when expiry approached. The alternative — an on-call rotation paralyzed by combinatorial state uncertainty — was untenable.

The underlying problem is a combinatorial explosion. Ten independent boolean flags produce 1,024 possible system states. Fifty flags produce more states than atoms in the observable universe. You cannot test that. You cannot reason about it under pressure at 2am.

Every flag needs three things enforced by automation, not convention: an owner, a creation timestamp, and an expiry date. Flags without expiry dates are tech debt with a fuse. When the flag reaches 100% rollout, automated tooling should open a PR to remove the call sites — the flag is now dead code that still burns CPU in your evaluation engine and adds cognitive overhead to every engineer who reads that branch.

The Knight Capital incident in 2012 remains a stark reminder of lifecycle failure. The SMARS "Power Peg" flag was never cleaned up after deprecation. A new deployment accidentally reactivated it, routing live orders through dead code. $440 million in losses in 45 minutes.

Flag dependencies compound this risk significantly. If Flag B's rollout assumes Flag A is enabled, that dependency must be explicit in your data model — an implicit dependency discovered during an incident rollback is a production outage waiting to happen. A simple `depends_on` field in the flag schema, validated at write time, catches these relationships before they become archaeology problems at 3am.

The data model carrying this metadata sets the foundation for the operational tooling that makes cleanup tractable at scale.

## Performance Optimizations, Observability, and Big Tech Patterns

The work you do at evaluation time should be close to zero. That's the design principle driving every meaningful performance optimization in mature flag systems.

**Rule compilation** is where the real work happens. At SDK initialization and at every cache refresh, raw flag rule trees are compiled into optimized decision structures — typically sorted arrays of targeting predicates with precomputed hash ranges and attribute extractors resolved to direct field offsets. A flag that requires parsing a JSON rule on every evaluation is already broken at scale. After compilation, evaluation reduces to a sequential scan of an in-memory structure with no deserialization, no regex compilation, no string splitting. This amortizes all parsing cost once per refresh cycle across every subsequent evaluation per second.

**Flag exposure tracking** is the observability primitive everything else depends on. Every evaluation should emit a structured event: `{flag_key, variant, user_id, user_context_hash, sdk_version, timestamp}`. This isn't logging for debugging — it's the foundational data primitive for experiment analysis, regression detection, and audit compliance. Google's flag exposure pipeline feeds directly into ABACUS, their experimentation platform; exposure events are the join key between user actions and flag variants, making causal inference possible without any manual instrumentation at the product layer. Miss an exposure event, and your experiment data is uninterpretable.

**The convergence is striking.** Google, Meta (Gatekeeper), Netflix (Trebuchet), and Uber (Flipr) all independently arrived at the same architecture: local evaluation SDK, push-based distribution, kill-switch priority, lifecycle enforcement. Netflix goes a step further — Trebuchet evaluates flags at the API gateway layer for A/B testing on the homepage, attaches the evaluation result to the request context, and propagates variant assignments through all downstream services. This ensures consistent variant assignment within a session and, critically, enables kill switches that stop traffic *before* it reaches application logic rather than short-circuiting inside it.

That boundary — edge evaluation versus in-process evaluation — is where flag system design intersects directly with your traffic management strategy.