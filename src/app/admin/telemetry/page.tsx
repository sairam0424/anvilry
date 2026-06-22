import { redis } from "@/lib/redis";
import { KIND_LITERALS, type TelemetryEvent } from "@/lib/telemetry/schema";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Data layer ────────────────────────────────────────────────────────────────

async function fetchKind(kind: string, since: number): Promise<TelemetryEvent[]> {
  if (!redis) return [];
  try {
    const raw = await redis.zrange<TelemetryEvent[]>(`anvilry:trace:${kind}`, since, "+inf", {
      byScore: true,
    });
    return (raw ?? []).filter((e): e is TelemetryEvent => e !== null && typeof e === "object");
  } catch {
    return [];
  }
}

async function fetchAll(since: number): Promise<TelemetryEvent[]> {
  const results = await Promise.all(KIND_LITERALS.map((k) => fetchKind(k, since)));
  return results.flat().sort((a, b) => a.ts - b.ts);
}

// ── Compute tiles ─────────────────────────────────────────────────────────────

function cacheHitRate(llmAttempts: TelemetryEvent[]) {
  let totalInput = 0;
  let cacheRead = 0;
  let totalTokens = 0;
  let totalOutputTokens = 0;
  for (const e of llmAttempts) {
    const u = (e.attrs as Record<string, unknown>).usage as Record<string, number> | undefined;
    if (u) {
      const inp = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      totalInput += inp;
      cacheRead += u.cache_read_input_tokens ?? 0;
      totalTokens += inp + (u.output_tokens ?? 0);
      totalOutputTokens += u.output_tokens ?? 0;
    }
  }
  return {
    pct: totalInput === 0 ? 0 : Math.round((cacheRead / totalInput) * 100),
    cacheRead,
    totalInput,
    totalTokens,
    totalOutputTokens,
  };
}

function avgLatency(llmAttempts: TelemetryEvent[]): number {
  const withLatency = llmAttempts.filter((e) => typeof (e.attrs as Record<string, unknown>).latency_ms === "number");
  if (withLatency.length === 0) return 0;
  const sum = withLatency.reduce((acc, e) => acc + ((e.attrs as Record<string, unknown>).latency_ms as number), 0);
  return Math.round(sum / withLatency.length);
}

function avgTtft(llmAttempts: TelemetryEvent[]): number {
  const withTtft = llmAttempts.filter((e) => typeof (e.attrs as Record<string, unknown>).ttft_ms === "number");
  if (withTtft.length === 0) return 0;
  const sum = withTtft.reduce((acc, e) => acc + ((e.attrs as Record<string, unknown>).ttft_ms as number), 0);
  return Math.round(sum / withTtft.length);
}

function fallbackRate(llmAttempts: TelemetryEvent[]): number {
  if (llmAttempts.length === 0) return 0;
  const fallen = llmAttempts.filter((e) => (e.attrs as Record<string, unknown>).fell_back).length;
  return Math.round((fallen / llmAttempts.length) * 100);
}

// Cost per cache-read token in USD per million tokens
const CACHE_READ_PRICE_PER_MTOK = 0.30;

function costSummary(llmAttempts: TelemetryEvent[]): { totalUsd: number; savedUsd: number } {
  let totalUsd = 0;
  let savedUsd = 0;
  for (const e of llmAttempts) {
    const a = e.attrs as Record<string, unknown>;
    if (typeof a.cost_usd === "number") {
      totalUsd += a.cost_usd;
    }
    const u = a.usage as Record<string, number> | undefined;
    if (u?.cache_read_input_tokens) {
      savedUsd += (u.cache_read_input_tokens / 1_000_000) * CACHE_READ_PRICE_PER_MTOK;
    }
  }
  return { totalUsd, savedUsd };
}

function uniqueSessions(httpRequests: TelemetryEvent[]): { count: number; allAnonymous: boolean } {
  const ids = new Set<string>();
  let allAnonymous = true;
  for (const e of httpRequests) {
    const sessionId = (e.attrs as Record<string, unknown>).session_id;
    if (typeof sessionId === "string" && sessionId !== "anonymous") {
      ids.add(sessionId);
      allAnonymous = false;
    }
  }
  return { count: ids.size, allAnonymous: httpRequests.length === 0 || allAnonymous };
}

// Per-model cost breakdown for the Costs tab.
type ModelCostRow = { model: string; calls: number; totalUsd: number; cacheRead: number; cacheWrite: number };

function costByModel(llmAttempts: TelemetryEvent[]): ModelCostRow[] {
  const map = new Map<string, ModelCostRow>();
  for (const e of llmAttempts) {
    const a = e.attrs as Record<string, unknown>;
    const model = (a.model as string | undefined) ?? "unknown";
    const existing = map.get(model) ?? { model, calls: 0, totalUsd: 0, cacheRead: 0, cacheWrite: 0 };
    existing.calls += 1;
    existing.totalUsd += typeof a.cost_usd === "number" ? a.cost_usd : 0;
    const u = a.usage as Record<string, number> | undefined;
    existing.cacheRead += u?.cache_read_input_tokens ?? 0;
    existing.cacheWrite += u?.cache_creation_input_tokens ?? 0;
    map.set(model, existing);
  }
  return [...map.values()].sort((a, b) => b.totalUsd - a.totalUsd);
}

// P50/P95 latency for a TelemetryEvent array (from latency_ms attr).
type LatencyStats = { p50: number; p95: number; count: number };

function latencyStats(events: TelemetryEvent[]): LatencyStats {
  const vals = events
    .map((e) => (e.attrs as Record<string, unknown>).latency_ms as number)
    .filter((v) => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  if (vals.length === 0) return { p50: 0, p95: 0, count: 0 };
  return {
    p50: vals[Math.floor(vals.length * 0.50)] ?? 0,
    p95: vals[Math.floor(vals.length * 0.95)] ?? 0,
    count: vals.length,
  };
}

// Read the latest eval result from Redis (written by /api/cron/eval).
async function fetchEvalResult(): Promise<{ pass_rate: number; run_at: number; total: number } | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get<string | object>("anvilry:eval:latest");
    if (!raw) return null;
    if (typeof raw === "object") return raw as { pass_rate: number; run_at: number; total: number };
    return JSON.parse(raw as string) as { pass_rate: number; run_at: number; total: number };
  } catch {
    return null;
  }
}

function routeCounts(httpRequests: TelemetryEvent[]): Array<{ route: string; count: number; avgMs: number }> {
  const counts: Record<string, { count: number; totalMs: number }> = {};
  for (const e of httpRequests) {
    const route = e.route ?? "unknown";
    const latMs = (e.attrs as Record<string, unknown>).latency_ms as number ?? 0;
    if (!counts[route]) counts[route] = { count: 0, totalMs: 0 };
    counts[route].count += 1;
    counts[route].totalMs += latMs;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([route, { count, totalMs }]) => ({ route, count, avgMs: Math.round(totalMs / count) }));
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").replace(/\.\d{3}Z/, " UTC");
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function truncate(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// Extract the most useful attrs for each kind for the events table
function fmtAttrs(e: TelemetryEvent): string {
  const a = e.attrs as Record<string, unknown>;
  switch (e.kind) {
    case "llm.attempt": {
      const u = a.usage as Record<string, number> | undefined;
      const parts = [];
      if (a.model) parts.push(String(a.model).replace("us.anthropic.claude-", ""));
      if (u?.input_tokens != null) parts.push(`in:${u.input_tokens}`);
      if (u?.cache_read_input_tokens) parts.push(`cached:${u.cache_read_input_tokens}`);
      if (u?.output_tokens != null) parts.push(`out:${u.output_tokens}`);
      if (a.ttft_ms != null) parts.push(`ttft:${fmtMs(a.ttft_ms as number)}`);
      if (a.latency_ms != null) parts.push(`lat:${fmtMs(a.latency_ms as number)}`);
      if (a.fell_back) parts.push("⚡fallback");
      if (a.finish_reason) parts.push(String(a.finish_reason));
      if (typeof a.cost_usd === "number") parts.push(`$${a.cost_usd.toFixed(4)}`);
      return parts.join("  ·  ");
    }
    case "http.request": {
      const parts = [];
      if (a.status != null) parts.push(`${a.status}`);
      if (a.latency_ms != null) parts.push(fmtMs(a.latency_ms as number));
      if (a.messageCount != null) parts.push(`msgs:${a.messageCount}`);
      if (a.cache_hit != null) parts.push(a.cache_hit ? "cache:hit" : "cache:miss");
      if (a.char_count != null) parts.push(`chars:${a.char_count}`);
      if (typeof a.session_id === "string" && a.session_id !== "anonymous") {
        parts.push(`sess:${a.session_id.slice(0, 6)}`);
      }
      return parts.join("  ·  ");
    }
    case "client.error":
    case "server.error":
      return [a.error_name, a.error_message, a.aws_request_id ? `aws:${String(a.aws_request_id).slice(0, 8)}` : null]
        .filter(Boolean)
        .join("  ·  ") as string;
    default:
      return truncate(JSON.stringify(a), 100);
  }
}

// ── Kind badge ────────────────────────────────────────────────────────────────

function kindBadge(kind: string): string {
  switch (kind) {
    case "llm.attempt":    return "bg-violet-500/20 text-violet-300";
    case "http.request":   return "bg-blue-500/20 text-blue-300";
    case "client.error":   return "bg-red-500/20 text-red-300";
    case "server.error":   return "bg-orange-500/20 text-orange-300";
    case "tts.request":    return "bg-teal-500/20 text-teal-300";
    case "budget.tick":    return "bg-yellow-500/20 text-yellow-300";
    default:               return "bg-bg-elevated text-fg-muted";
  }
}

// ── Tile component ────────────────────────────────────────────────────────────

function Tile({ label, value, sub, pct, accent = false, warn = false }: {
  label: string; value: string; sub?: string; pct?: number; accent?: boolean; warn?: boolean;
}) {
  const color = warn ? "text-red-400" : accent ? "text-accent" : "text-fg";
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong/60 bg-bg-surface p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">{label}</span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</span>
      {sub && <span className="text-[11px] text-fg-subtle">{sub}</span>}
      {pct != null && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div
            className={`h-full rounded-full ${warn ? "bg-red-400" : accent ? "bg-accent" : "bg-fg-muted/50"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TelemetryDashboard() {
  // Auth is handled upstream by src/proxy.ts — by the time this renders,
  // the request is authenticated. No html/body shell here; the layout provides those.
  // eslint-disable-next-line react-hooks/purity -- async Server Component, not a client render
  const now = Date.now();
  const since24h = now - 24 * 60 * 60 * 1000;

  const [allEvents, ttsEvents, transcribeEvents, evalResult] = await Promise.all([
    fetchAll(since24h),
    fetchKind("tts.request", since24h),
    fetchKind("transcribe.request", since24h),
    fetchEvalResult(),
  ]);
  const llmAttempts = allEvents.filter((e) => e.kind === "llm.attempt");
  const httpRequests = allEvents.filter((e) => e.kind === "http.request");
  const clientErrors = allEvents.filter((e) => e.kind === "client.error");
  const serverErrors = allEvents.filter((e) => e.kind === "server.error");

  const errorCount = clientErrors.length + serverErrors.length;
  const errorRate = allEvents.length > 0 ? Math.round((errorCount / allEvents.length) * 100) : 0;
  const routes = routeCounts(httpRequests);
  const cache = cacheHitRate(llmAttempts);
  const fallback = fallbackRate(llmAttempts);
  const latency = avgLatency(llmAttempts);
  const ttft = avgTtft(llmAttempts);
  const recentEvents = [...allEvents].reverse().slice(0, 100);
  const redisStatus = redis ? "connected" : "not configured (log-only mode)";
  const cost = costSummary(llmAttempts);
  const sessions = uniqueSessions(httpRequests);
  const avgTurns = sessions.count > 0 ? (httpRequests.length / sessions.count).toFixed(1) : "—";

  // New: Costs + Voice + Eval data
  const modelCosts = costByModel(llmAttempts);
  const ttsLatency = latencyStats(ttsEvents);
  const transcribeLatency = latencyStats(transcribeEvents);
  const evalPct = evalResult ? Math.round(evalResult.pass_rate * 100) : null;

  // Format total tokens as K
  const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="min-h-screen bg-bg-base p-4 font-sans text-fg md:p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-fg">Anvilry telemetry</h1>
            <p className="mt-1 text-xs text-fg-muted">
              Last 24 h &nbsp;·&nbsp; {allEvents.length} events &nbsp;·&nbsp; Redis: {redisStatus}
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
            {new Date(now).toISOString().slice(0, 16).replace("T", " ")} UTC
          </span>
        </header>

        {/* Tiles — row 1: volume + cache + cost */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile
            label="Events (24h)"
            value={String(allEvents.length)}
            sub={`${httpRequests.length} req · ${llmAttempts.length} LLM`}
          />
          <Tile
            label="Cache hit rate"
            value={`${cache.pct}%`}
            sub={`${fmtTokens(cache.cacheRead)} / ${fmtTokens(cache.totalInput)} tokens`}
            pct={cache.pct}
            accent={cache.pct > 30}
          />
          <Tile
            label="Total tokens"
            value={fmtTokens(cache.totalTokens)}
            sub={`↑${fmtTokens(cache.totalInput)} in · ↓${fmtTokens(cache.totalOutputTokens)} out`}
          />
          <Tile
            label="Fallback rate"
            value={`${fallback}%`}
            sub="model fell back in chain"
            pct={fallback}
            warn={fallback > 20}
          />
          <Tile
            label="Est. cost (24h)"
            value={`$${cost.totalUsd.toFixed(4)}`}
            sub={`saved $${cost.savedUsd.toFixed(4)} by caching`}
            accent={cost.savedUsd > 0}
          />
        </div>

        {/* Tiles — row 2: latency + errors + visitors */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile
            label="Avg LLM latency"
            value={latency > 0 ? fmtMs(latency) : "—"}
            sub={ttft > 0 ? `TTFT: ${fmtMs(ttft)}` : "no data yet"}
          />
          <Tile
            label="Error rate"
            value={`${errorRate}%`}
            sub={`${errorCount} errors total`}
            pct={errorRate}
            warn={errorRate > 5}
          />
          <Tile
            label="Client errors"
            value={String(clientErrors.length)}
            sub="boundary + window catches"
            warn={clientErrors.length > 0}
          />
          <Tile
            label="Server errors"
            value={String(serverErrors.length)}
            sub="caught exceptions"
            warn={serverErrors.length > 0}
          />
          <Tile
            label="Visitors (24h)"
            value={sessions.allAnonymous ? "—" : String(sessions.count)}
            sub={
              sessions.allAnonymous
                ? "set TELEMETRY_IP_SALT to enable"
                : `avg ${avgTurns} req/session`
            }
            accent={!sessions.allAnonymous && sessions.count > 0}
          />
        </div>

        {/* Route breakdown */}
        {routes.length > 0 && (
          <div className="mb-6 rounded-xl border border-border-strong/60 bg-bg-surface p-4">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted">
              Route breakdown
            </h2>
            <div className="flex flex-col gap-2">
              {routes.map(({ route, count, avgMs }) => {
                const pct = Math.round((count / Math.max(1, httpRequests.length)) * 100);
                return (
                  <div key={route} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 font-mono text-xs text-fg-muted">{route}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                      <div className="h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs text-fg-subtle">{count}</span>
                    <span className="w-14 text-right font-mono text-[10px] text-fg-subtle/70">
                      {avgMs > 0 ? fmtMs(avgMs) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Costs breakdown ─────────────────────────────────────────── */}
        <div className="mb-6 rounded-xl border border-border-strong/60 bg-bg-surface p-4">
          <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted">
            Model cost breakdown (24h)
          </h2>
          {modelCosts.length === 0 ? (
            <p className="text-sm text-fg-subtle">No llm.attempt events yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-strong/20 text-left font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                  <th className="px-2 py-2">Model</th>
                  <th className="px-2 py-2 text-right">Calls</th>
                  <th className="px-2 py-2 text-right">Total cost</th>
                  <th className="px-2 py-2 text-right">Cache read tok</th>
                  <th className="px-2 py-2 text-right">Cache write tok</th>
                </tr>
              </thead>
              <tbody>
                {modelCosts.map((row) => (
                  <tr key={row.model} className="border-b border-border-strong/10 hover:bg-bg-elevated/40">
                    <td className="px-2 py-2 font-mono text-fg-muted">
                      {row.model.replace("us.anthropic.claude-", "")}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-fg-subtle">{row.calls}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-accent">${row.totalUsd.toFixed(4)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-fg-subtle">{fmtTokens(row.cacheRead)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-fg-subtle">{fmtTokens(row.cacheWrite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Voice + Eval tiles ──────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile
            label="TTS P50 latency"
            value={ttsLatency.count > 0 ? fmtMs(ttsLatency.p50) : "—"}
            sub={ttsLatency.count > 0 ? `${ttsLatency.count} requests` : "no TTS requests yet"}
          />
          <Tile
            label="TTS P95 latency"
            value={ttsLatency.count > 0 ? fmtMs(ttsLatency.p95) : "—"}
            sub="high-percentile TTS"
            warn={ttsLatency.p95 > 3000}
          />
          <Tile
            label="Transcribe P50"
            value={transcribeLatency.count > 0 ? fmtMs(transcribeLatency.p50) : "—"}
            sub={transcribeLatency.count > 0 ? `${transcribeLatency.count} requests` : "no transcribe yet"}
          />
          <Tile
            label="Transcribe P95"
            value={transcribeLatency.count > 0 ? fmtMs(transcribeLatency.p95) : "—"}
            sub="high-percentile STT"
            warn={transcribeLatency.p95 > 5000}
          />
          <Tile
            label="Eval pass rate"
            value={evalPct != null ? `${evalPct}%` : "—"}
            sub={evalResult ? `${evalResult.total} golden pairs · ${new Date(evalResult.run_at).toLocaleDateString()}` : "run /api/cron/eval to populate"}
            accent={evalPct != null && evalPct >= 90}
            warn={evalPct != null && evalPct < 80}
            pct={evalPct ?? undefined}
          />
        </div>

        {/* Recent events table */}
        <div className="rounded-xl border border-border-strong/60 bg-bg-surface">
          <div className="border-b border-border-strong/40 px-4 py-3">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
              Recent events &nbsp;·&nbsp; last {recentEvents.length} of {allEvents.length}
            </h2>
          </div>
          {recentEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-subtle">
              {redis
                ? "No events yet. Send a chat message to start populating."
                : "Upstash Redis not configured — set UPSTASH_REDIS_REST_URL + _TOKEN."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-strong/20 text-left font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                    <th className="px-4 py-2 whitespace-nowrap">Time (UTC)</th>
                    <th className="px-4 py-2">Kind</th>
                    <th className="px-4 py-2">Route</th>
                    <th className="px-4 py-2">TraceId</th>
                    <th className="px-4 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e, i) => {
                    const isError = e.level === "error";
                    const attrs = e.attrs as Record<string, unknown>;
                    return (
                      <tr
                        key={`${e.ts}-${i}`}
                        className={`border-b border-border-strong/10 hover:bg-bg-elevated/40 ${
                          isError ? "bg-red-500/5" : ""
                        }`}
                      >
                        <td className="px-4 py-2 font-mono text-fg-subtle whitespace-nowrap">
                          {fmtTs(e.ts)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] ${kindBadge(e.kind)}`}>
                            {e.kind}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-fg-muted">
                          {e.route ?? "—"}
                          {attrs.status != null && (
                            <span className={`ml-1.5 text-[10px] ${Number(attrs.status) >= 400 ? "text-red-400" : "text-fg-subtle/60"}`}>
                              {String(attrs.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-fg-subtle/60 whitespace-nowrap">
                          {e.traceId ? e.traceId.slice(0, 8) + "…" : "—"}
                        </td>
                        <td className="px-4 py-2 text-fg-subtle max-w-[480px]">
                          {isError ? (
                            <span className="text-red-300">{fmtAttrs(e)}</span>
                          ) : (
                            <span className="text-fg-subtle/80">{fmtAttrs(e)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
