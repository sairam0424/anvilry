---
slug: how-i-built-tombstone-feature-flag-intelligence-platform
title: "How I Built Tombstone: A Self-Hosted Feature Flag Intelligence Platform to Prevent the Next Knight Capital"
date: 2026-06-27
summary: "A first-person engineering account of building Tombstone — an 8-service, self-hosted feature flag platform with tombstoned keys, causal incident correlation, and circuit-breaker auto-rollback — born from a 2am on-call incident and the realization that Jira plus Notion is not an audit trail."
tags: ["feature-flags", "system-design", "open-source", "devops", "incident-response", "distributed-systems"]
draft: false
tone: senior
format: narrative
length: comprehensive
category: system-design
wordCount: 3531
readingTime: 13
generatedBy: inkforge
platforms: []
---

## The 2am Dashboard That Started Everything

It was 2:47am when I opened our feature flag dashboard and realized I had no idea what had changed. P99 latency on our payments service had spiked to 4.2 seconds about 20 minutes earlier, and the on-call playbook said to check recent flag changes first. We had LaunchDarkly for flag evaluation, Jira for change tickets, and a Notion doc that was supposed to track active experiment flags. The Notion doc hadn't been touched in six weeks. The Slack channel that was nominally our audit log had 340 unread messages from the previous day's deploy sprint.

The actual question I needed to answer — *which flags changed in the last 30 minutes across all services* — had no answer. Not a slow answer, not an approximate answer. No answer.

That's a knowledge management failure, not an infrastructure failure. We had three systems that each held a partial slice of production state and shared exactly zero causal model between them. LaunchDarkly knew flag evaluation counts. Jira knew someone opened a ticket. Notion knew whatever someone remembered to type. None of them knew that a flag flip in service A at 2:31am might be causally related to the latency spike in service B at 2:33am.

Knight Capital in 2012 is the canonical proof that this failure mode is existentially dangerous. They lost $440 million in 45 minutes — not because their trading system was buggy, but because the `POWER_PHLX` flag key was reactivated on only one of eight servers during a deployment. That reactivation woke up dormant RLP (Repurposing Liquidity Provider) code that had been dead for eight years. No system tracked key provenance. No system blocked reuse of a key that had previously controlled live trading logic. The blast radius was uncontained because the organization treated flag state as ephemeral configuration rather than durable history.

Atlassian published a post about hitting 4,000+ active feature flags at scale. At that volume, on-call engineers can no longer reason about which flags are safe to flip during an active incident. The flags become load-bearing in ways nobody documented, and the institutional knowledge of which key controls what behavior lives entirely in the heads of engineers who may not be on the incident bridge.

We were at 200+ flags across 12 services when I hit my 2am wall. Nowhere near Atlassian scale, but already past the threshold where a Notion doc and a Slack channel constitutes an audit trail.

Tombstone is the system I wish had existed that night — and understanding why the existing toolchain fundamentally can't be patched into something safe requires starting with how flags actually fail in production.

## Tombstoning: The Single Most Important Safety Property

Every feature flag platform I've used treats flag deletion as a soft operation — mark the row inactive, maybe hide it from the UI, but leave the key string available for reuse. This is catastrophically wrong, and Knight Capital proves it.

In 2003, Knight deprecated their RLP (Repurpose Liquidity Provider) functionality. The `POWER_PHLX` flag key that controlled it sat dormant. Nine years later, during a routine deployment, eight of nine servers had SMARS code installed; the ninth still ran the old code path gated by that same key. When the flag was "reactivated," the ninth server interpreted it with 2003 semantics while the rest used 2012 semantics. $440 million, 45 minutes. If `POWER_PHLX` had been tombstoned after RLP deprecation, the 2012 reactivation attempt would have been rejected at the control plane — before a single byte reached a trading server.

The core invariant in Tombstone is this: **a flag key is a permanent identifier, not a reusable string.** Once archived, a key is cryptographically retired. This isn't a policy; it's a database constraint.

```sql
CREATE TABLE tombstones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key     TEXT NOT NULL,
    archived_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_by  UUID NOT NULL REFERENCES users(id),
    final_audit_entry_id UUID NOT NULL REFERENCES audit_log(id),
    merkle_hash  BYTEA NOT NULL,
    CONSTRAINT uq_tombstones_flag_key UNIQUE (flag_key)
);

-- Enforced via trigger on flags INSERT:
CREATE CONSTRAINT TRIGGER prevent_tombstoned_key_reuse
    AFTER INSERT ON flags
    DEFERRABLE INITIALLY IMMEDIATE
    FOR EACH ROW EXECUTE FUNCTION reject_if_tombstoned();
```

Any `INSERT` into `flags` with a tombstoned key raises a constraint violation at the database layer — the service layer never even makes the decision. This dual enforcement matters: application bugs don't open a gap.

The tombstone record itself is append-only and Merkle-linked to the final audit log entry at time of archival. You cannot update a tombstone row. You cannot delete it. The `merkle_hash` chains each tombstone to its predecessor, so tampering with the archive history changes the hash and becomes detectable. The operation is designed to be irreversible by construction, not by convention.

The operational consequence is intentional friction. Engineers cannot recycle keys — they must create a new key with a new name for new behavior. I've found this forcing function has secondary benefits: teams start naming flags with lifecycle semantics baked in (`checkout_v2_stripe_migration` rather than `new_checkout`), and the tombstone audit trail becomes an accurate historical record of what that key *meant*, not just what it *does now*.

This append-only archive is what gives the audit chain its integrity guarantees — which turns out to be load-bearing for incident response.

## Causal Incident Correlation: Turning a 3-Hour Post-Mortem Into a 10-Second Report

The post-mortem ritual I was stuck in before Tombstone looked like this: PagerDuty fires, I acknowledge, then I spend the next hour manually cross-referencing Slack messages, Jira tickets, and a feature flag dashboard that shows current state with no temporal depth. The actual causal flag change might be sitting right there in plain sight — I just had no tooling to surface it.

The query model I built is deliberately simple. On PagerDuty webhook receipt, Tombstone's correlation service scans the append-only audit log for every flag state change within a configurable lookback window (default 30 minutes, tunable per environment). The append-only constraint matters here — I'm not reconstructing state from a mutable table, I'm replaying a ledger. Every write is a new row with an immutable timestamp, actor, flag key, previous value, and new value. The query is a bounded range scan, not a diff computation.

What makes the output useful rather than just noisy is the scoring layer. Raw recency isn't enough — if three flags changed in the same deploy window, listing them alphabetically is useless. I apply exponential recency decay: a change 2 minutes before the alert timestamp scores dramatically higher than one 28 minutes prior. The ranking answers not just *what changed* but *what changed in a way that is temporally suspicious*.

The output contract is fixed: top 3 correlation candidates, each containing actor, `delta_seconds_before_alert`, flag key, previous value, new value, and a pre-signed rollback link that's valid for 15 minutes. The pre-signed link is load-bearing — it means the on-call engineer can execute a rollback without navigating any UI, without elevated permissions at 3am, and without touching the flag's current live state directly.

```json
{
  "candidate_rank": 1,
  "flag_key": "pricing.v2_calculation_engine",
  "actor": "deploy-bot@internal",
  "previous_value": false,
  "new_value": true,
  "delta_seconds_before_alert": 247,
  "rollback_url": "https://tombstone.internal/rollback/pre-signed/abc123"
}
```

The real-world validation came during a payment error spike. A flag enabling a new pricing calculation had been toggled 4 minutes before the error rate climbed. Tombstone surfaced it as candidate #1. The on-call engineer clicked the rollback link without opening a single log query or Kibana tab. Total time from page to rollback: under 90 seconds.

The failure mode I spent the most time on was false positives from scheduled changes. A cron job toggling a flag at 3am scores high on recency decay but is completely unrelated to an unconnected incident. Tombstone now cross-references a pre-approval registry — any scheduled change with a corresponding approval record gets annotated as `"scheduled": true, "pre_approved": true` in the correlation output, which visually de-prioritizes it for the on-call engineer without removing it from the candidate list entirely.

Clock skew between services was the other edge case worth addressing explicitly — and it's where the circuit-breaker integration earns its keep.

## Circuit Breaker Auto-Rollback: The Safety Net That Fires Before You Ack the Page

The evaluator service runs a sliding window over per-flag error rates — 100 requests minimum sample, 5% error threshold. When a flag's error rate crosses that line, the evaluator doesn't wait for a human. It rolls back to the flag's declared `safe_default`, writes an audit entry, and hands off to the incident correlation pipeline. The whole sequence completes in under 200ms. By the time PagerDuty has routed the page to your phone, the blast radius is already contained.

Here's what that audit entry looks like when the circuit fires:

```json
{
  "event": "auto_rollback",
  "flag_key": "checkout_flow_v2",
  "triggered_by": "system:evaluator",
  "threshold": { "error_rate": 0.05, "window_requests": 100 },
  "sample_request_id": "req_7f3a92c",
  "crossed_at_request": 104,
  "rolled_back_to": "control",
  "timestamp": "2024-11-14T02:47:33.812Z"
}
```

That's not just a log line — it's a first-class audit event, Merkle-linked into the same append-only chain as every human-initiated change. The rollback is attributable, reproducible, and queryable. `triggered_by: system:evaluator` is a real actor in the system, not a null field.

I designed this around a concrete scenario: a `checkout_flow_v2` flag rolls to 10% of traffic. Latency spikes 800ms. Error rate crosses 5% at request #104. The evaluator rolls back, the causal correlation pipeline attaches the latency/error timeline to the incident, and the PagerDuty alert arrives with the rollback confirmation and the causal report pre-attached. The on-call engineer reads a complete picture, not a blank canvas.

Blast-radius scoring gates whether that automation is even allowed to fire. A flag scored `BLOCKED` — one that touches payments, auth, or any dependency marked critical — cannot be auto-rolled back. It requires four-eyes sign-off before the rollback executes. `HIGH` flags get auto-rollback but with immediate escalation. `MEDIUM` and `LOW` roll back silently and generate a low-priority ticket.

The known gap I haven't fully closed: flags controlling background jobs that fail silently. If errors don't surface as HTTP 5xx responses, the sliding window never sees them. A worker that swallows exceptions and logs to nowhere keeps the error rate at zero while the job queue backs up. I've found this is a signal registration problem — the evaluator exposes a health signal API, but it's opt-in, and teams running background jobs rarely think to wire it up until something burns.

That silent failure mode is exactly why blast-radius scoring alone isn't sufficient — it scores the flag's potential impact, but it can't compensate for missing telemetry.

## The Architecture: 8 Services, One Causal Model

The core architectural decision I made early was a hard separation between the control plane and the data plane — and I mean hard, not "they talk to different database schemas" hard.

**flag-api** (`:8081`) owns all writes. Every flag mutation, every rollout percentage change, every tombstone — nothing lands in the system without going through flag-api. It maintains the append-only Merkle-linked audit log, where each entry is structured as:

```json
{
  "entry_id": "01HX...",
  "payload_hash": "sha256(current_payload)",
  "prev_hash": "sha256(prev_entry.payload_hash + prev_entry.prev_hash)",
  "timestamp": "2024-11-03T02:47:13Z",
  "actor": "svc:gitops-sync",
  "change": { "flag": "dark-launch-v2", "op": "rollout_update", "pct": 15 }
}
```

Tamper detection is an O(n) chain walk — you rehash each entry against its predecessor. On startup and on every export request, flag-api verifies the full chain. It's not blockchain theater; it's the minimum viable guarantee that a Jira ticket edit didn't quietly retrograde your audit history.

**gateway** (`:8080`) owns all reads. SDKs never talk to flag-api. Gateway streams flag state changes via SSE, backed by Redis Streams consumer groups. This is where I diverged from a naïve polling architecture.

With polling, a restarting SDK instance loses the delta between its last poll and reconnect. With consumer groups, each connected SDK instance registers a named consumer in Redis Streams:

```
XREADGROUP GROUP tombstone-sdks sdk-instance-{uuid}
  COUNT 100 BLOCK 0 STREAMS tombstone:flag-changes >
```

On reconnect after a rolling deploy, the consumer resumes from its last acknowledged offset — `>` becomes the last unacknowledged ID. No change is skipped. Flag updates reach SDK in-process caches in under 10 milliseconds under normal load, not because I did anything clever, but because SSE over a persistent connection and Redis Streams at localhost latency are just fast.

**evaluator** (`:8082`) is the piece I'm most deliberate about. It sits in the data path conceptually — it observes the evaluation stream — but it is explicitly *not* in the hot path. Blast-radius scoring and circuit-breaker logic run async against a mirrored evaluation event stream. Flag resolution itself never blocks waiting for the evaluator. When the evaluator detects a threshold breach, it writes a rollback command back through flag-api. The latency budget for flag resolution stays in the microseconds; the evaluator can take 50ms to compute a blast radius score and nothing degrades.

The lifecycle bookends are **gitops-sync** (`:8084`) and **ast-rewriter** (`:8085`). Flags enter the system as YAML-as-code via Git PRs — gitops-sync watches the repo, validates schema, and calls flag-api on merge. Flags exit via ast-rewriter, which runs dead-code analysis against the TypeScript and Python SDKs' call sites and opens automated PRs to remove stale references. The tombstone mechanism is what makes ast-rewriter trustworthy: a key can't be rewritten out of the codebase while it's still receiving non-zero evaluation traffic.

The remaining three services — the OPA policy enforcer, the MCP server, and the OpenTelemetry collector sidecar — round out the platform. Each declares clear responsibilities within this topology, though the causal correlation model depends most critically on trace propagation being correct end-to-end.

## Blast Radius Gate and Four-Eyes Approval: Enforcing Change Discipline at the Control Plane

The evaluator service computes a blast-radius score on every flag write — not just at creation. Touch a targeting rule and the score recalculates immediately based on which service paths evaluate that flag. BLOCKED flags sit on authentication or payment codepaths and require two approvals before any change ships. HIGH flags require one. MEDIUM and LOW are self-serve. The tiers aren't static labels you set once and forget; they're derived from actual evaluation telemetry, so a flag that started as MEDIUM quietly becomes BLOCKED the moment your payment service starts evaluating it.

The four-eyes enforcement lives at the service layer in `flag-api`, not in the UI. That distinction matters. I've seen too many "approval workflows" that are really just frontend validation — one direct API call and the gate evaporates. In Tombstone, the control plane rejects the activation request if the approval count doesn't meet the threshold for that blast-radius tier, full stop. Self-approval is also rejected at the service layer: the approver's identity is checked against the requester's identity on every activation, so a solo engineer can't route around the requirement by approving their own pending change.

That specific edge case surfaced a real bug. A team tried to push a BLOCKED flag change at 11pm the night before a launch. No second approver was available, so they reached for the break-glass path — a signed token any engineer can generate to override the approval gate. The override works, but it fires an immediate Slack and PagerDuty notification to the on-call lead with the justification string the engineer provided. In this case, the engineering lead reviewed the alert, pulled up the diff, and caught a targeting rule that would have enabled a payment flow for 100% of users instead of the intended 1% canary cohort. The break-glass path is explicitly designed to be used; it's not a trap. But it makes the override visible and synchronous enough that a second set of eyes usually happens anyway.

Scheduled changes are a first-class primitive with cryptographic binding. An engineer authors a change now, a second engineer approves it, and the system executes at a future timestamp. The approval hash covers both the flag payload hash and the scheduled timestamp — if either is modified after approval, the scheduled execution is blocked and the original approver receives a notification. This closes the subtle attack surface where someone approves a change, then quietly updates the payload before it fires.

That binding property turns out to be essential once you start reasoning about the audit log as a causal record rather than a changelog.

## The ML Layer: Anomaly Detection, Stale Flag Hygiene, and Contextual Bandit Rollouts

The intelligence service (Python 3.12, `:8083`) runs a three-model ensemble because no single anomaly detector handles the full range of failure modes I care about.

**Z-score** handles baseline deviation against a rolling historical window — fast to compute, easy to reason about. But I burned myself on it during a Black Friday load test: evaluation volume spiked 8x on schedule, and Z-score lit up every flag touching the checkout path as anomalous. Seventeen alerts, all noise, exactly when I needed signal. **EWMA** solved that specific problem. It adapts the baseline dynamically, so a traffic ramp that follows the expected curve stays quiet. Genuine deviations — a flag evaluation rate that diverges from the trend rather than just exceeds a threshold — surface clearly. Z-score still runs; it catches sudden step changes that EWMA's decay factor would smooth over. The third model is **Isolation Forest**, operating across the multivariate space of correlated flags. A single flag's metrics looking normal doesn't mean the system is healthy — I've seen cases where two interdependent flags each showed marginal anomaly scores that combined into a real incident. Isolation Forest ingests the joint feature vector across all active flags sharing a prerequisite or targeting overlap and scores the ensemble, not the individual.

Stale flag hygiene is a problem that accumulates silently. The intelligence service queries flag evaluation counts over a configurable window (default 30 days). Flags with zero evaluations and no scheduled changes are surfaced as cleanup candidates — but I don't trust that signal alone. Before a flag is marked safe to archive, the `ast-rewriter` runs a static analysis pass across the codebase, resolving all key references. If `checkout_v2_redesign` still appears in a dead branch nobody merged or a feature spec file that imports the SDK, it doesn't get flagged for deletion. Only when the AST walk returns zero live references does the UI surface the "safe to archive" indicator.

The rollout recommendation engine uses **LinUCB**, a contextual bandit that treats rollout percentage as an arm selection problem. Context dimensions are geo, device class, and plan tier. Reward signals are conversion rate, error rate delta, and p95 latency. In production, a flag for a new recommendation algorithm started at 2% globally. The bandit observed that mobile users in the EU cohort were converting at 40% higher rates on the new algorithm — and autonomously recommended accelerating that arm to 15%, while holding the desktop cohort flat pending more data. Static percentage rollouts would have averaged that signal away entirely.

Semantic search rounds out the layer: flag descriptions are embedded at write time via `pgvector`, so engineers can query "find all flags related to checkout latency" and surface semantically related keys rather than hunting by prefix — which matters more than you'd expect once your flag count crosses a few hundred.

The intelligence service feeds back into the control plane, but that loop introduces its own consistency challenges.

## The 5-Step Evaluation Pipeline and Domain Loops

Every flag evaluation in Tombstone passes through the same five-gate pipeline — no shortcuts, no bypasses, even for internal callers.

```
1. Key existence + tombstone check        → reject unknown or tombstoned keys immediately
2. Prerequisite graph resolution          → recursively evaluate dependencies, depth-first
3. Targeting rule match (context input)   → first-match wins, rules ordered by priority
4. Variation assignment (consistent hash) → stable bucketing via MurmurHash3 on user_id + flag_key
5. Circuit-breaker gate                   → abort and return fallback if breaker is open
```

The prerequisite graph is the piece that surprised most reviewers when I first proposed it. Flags can declare hard dependencies — flag `B` requires flag `A` to be `on` before `B` will ever serve anything other than its default variation. Evaluation of `B` recursively resolves `A` first. The constraint I care about most is at the write path: cycles are detected via DFS at commit time and the write is rejected with a full cycle path in the error body. A team on our experimentation squad accidentally wired two experiment flags into a mutual dependency — `A` requires `B`, `B` requires `A`. The flag-api returned a `409` with `cycle_path: ["flag_A", "flag_B", "flag_A"]` and the write never landed. Without that check, evaluation would spin indefinitely.

The intelligence service runs three persistent domain loops — stale detection, anomaly scanning, and bandit reward collection — completely off the request path. They write recommendations back to the flag-api via authenticated internal POST; the evaluator never touches ML inference directly. This keeps P99 evaluation latency deterministic.

The marketplace service (`:8086`) is the integration fabric. Slack, Datadog, PagerDuty, OpsGenie, Jira, Linear, and OpenTelemetry adapters are registered plugins. Each declares an event subscription and a payload transform — no hardcoded webhooks. The OpenTelemetry adapter is the one I'd highlight: every evaluation emits a span carrying flag key, matched variation, targeting rule ID, and evaluation latency, which plugs directly into existing Datadog or Honeycomb dashboards with zero custom instrumentation.

That pipeline composability is what makes the next operational challenge — deploying this across environments without configuration drift — the real stress test.

## What v1.0.0 Ships, What I Learned, and Why It's Named Tombstone

v1.0.0 ships all eight services runnable locally with `make dev`: full Merkle-verified audit trail, causal incident correlation, circuit-breaker rollback, the three-model ML ensemble, and the React dashboard. It's production-ready for self-hosted deployment today.

The name is operational vocabulary, not branding. A tombstone is what you place on something permanently ended — the flag key is dead, its history is preserved, and nothing else can ever wear its identity. Knight Capital's ghost flag had no tombstone. That's the entire point.

The deepest lesson: the hard problem in feature flag infrastructure isn't evaluation performance — consistent hashing solves that in microseconds. It's knowledge continuity across personnel and time. A flag created in 2019 by an engineer who left in 2021 is still evaluating 50,000 times per day in 2024, and nobody knows what it gates or whether removing it will cause an incident. Tombstone's NLP search and stale detection surface it; the tombstone record preserves the full history permanently after archival.

What I'd change in v2: the Python intelligence service creates a language boundary that complicates deployment. The Z-score and EWMA models belong in the Go evaluator; only the Isolation Forest and contextual bandit justify the Python boundary. That change would collapse the service count from 8 to 6 and eliminate a failure surface that's bitten us twice in production.