#!/usr/bin/env node
/**
 * scripts/replay-trace.mjs — CLI for replaying a specific trace by ID.
 *
 * Usage:
 *   node scripts/replay-trace.mjs <traceId>
 *
 * Reads all telemetry events for the given traceId from Upstash Redis and
 * prints them in chronological order, pretty-printed. Requires the same
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars used by the
 * app. Reads from EVERY span kind so no events are missed.
 *
 * The traceId appears in:
 *   - The x-anvilry-trace-id response header on every /api/* response
 *   - The trace frame appended to /api/chat streaming responses (after U+001E)
 *   - Vercel Logs via `vercel logs --tail | jq 'select(.traceId=="<id>")'`
 *
 * Example workflow for a "Anvil gave me a wrong answer" report:
 *   1. Ask visitor for the x-anvilry-trace-id from their browser's Network tab
 *   2. node scripts/replay-trace.mjs <id>
 *   3. See: http.request → llm.attempt (which model, what usage, what error
 *      if any) → tts.request (which voice, cache_hit?) in one scrollable output
 */

import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error(
    "Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.\n" +
    "  export UPSTASH_REDIS_REST_URL=https://...\n" +
    "  export UPSTASH_REDIS_REST_TOKEN=...",
  );
  process.exit(1);
}

const traceId = process.argv[2];
if (!traceId) {
  console.error("Usage: node scripts/replay-trace.mjs <traceId>");
  process.exit(1);
}

const redis = new Redis({ url, token });

const KINDS = [
  "http.request",
  "llm.attempt",
  "tts.request",
  "transcribe.request",
  "client.error",
  "server.error",
  "budget.tick",
];

const allEvents = [];

for (const kind of KINDS) {
  const key = `anvilry:trace:${kind}`;
  try {
    // Fetch the last 7 days (the retention window). The score is the ts (epoch ms),
    // so we fetch the last week — more than enough for any incident investigation.
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const members = await redis.zrange(key, since, "+inf", { byScore: true });
    for (const m of members ?? []) {
      try {
        const event = JSON.parse(m);
        if (event.traceId === traceId) allEvents.push(event);
      } catch {
        // corrupt member — skip
      }
    }
  } catch (err) {
    console.warn(`[replay] Failed to fetch kind=${kind}: ${err.name}`);
  }
}

if (allEvents.length === 0) {
  console.log(`No events found for traceId: ${traceId}`);
  console.log("Check that the traceId is correct and within the 7-day retention window.");
  process.exit(0);
}

// Sort chronologically by ts (epoch ms).
allEvents.sort((a, b) => a.ts - b.ts);

const origin = allEvents[0].ts;
const fmt = (ts) => {
  const delta = ts - origin;
  const ms = delta % 1000;
  const s = Math.floor(delta / 1000);
  return `+${String(s).padStart(3, " ")}s ${String(ms).padStart(3, "0")}ms`;
};

console.log(`\n── Trace ${traceId} ── ${allEvents.length} events ──\n`);

for (const e of allEvents) {
  const level = (e.level ?? "info").toUpperCase().padEnd(5);
  const kind = (e.kind ?? "unknown").padEnd(20);
  const route = (e.route ?? "").padEnd(18);
  const msg = e.message ? `  msg="${e.message.slice(0, 60)}"` : "";
  console.log(`  ${fmt(e.ts)}  ${level}  ${kind}  ${route}${msg}`);
  if (e.attrs && Object.keys(e.attrs).length > 0) {
    console.log("              attrs:", JSON.stringify(e.attrs, null, 2).replace(/\n/g, "\n              "));
  }
  console.log();
}
