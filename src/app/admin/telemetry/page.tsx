import { redis } from "@/lib/redis";
import { KIND_LITERALS, type TelemetryEvent } from "@/lib/telemetry/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache — always fresh read

/**
 * /admin/telemetry — owner-only dashboard for the v1.8 telemetry pipeline.
 *
 * Gated by HTTP Basic Auth (ADMIN_PASSWORD env, see src/lib/admin-auth.ts).
 * Access: curl -u :YOUR_PASSWORD https://anvilry.vercel.app/admin/telemetry
 *   or visit the URL in a browser — the browser will pop up a Basic Auth
 *   dialog before showing the page.
 *
 * All rendering is server-side with plain Tailwind — no client JS, no chart
 * library, no CDN assets. The page is CSP-clean by construction and fast to
 * load even on a Vercel cold start because it's a single server component
 * with a handful of ZRANGEBYSCORE queries.
 *
 * Six tiles + a recent-events table:
 *   1. Events today — total count of all spans in the last 24h
 *   2. LLM attempts — count of llm.attempt spans (the prompt-caching tile)
 *   3. Cache hit rate — cache_read_input_tokens / total_input_tokens last 24h
 *   4. Error rate — count of level="error" events / total events last 24h
 *   5. Fallback rate — % of llm.attempt spans with fell_back=true
 *   6. Top routes by call count — breakdown of http.request spans by route
 */

// ── Data layer ────────────────────────────────────────────────────────────────

async function fetchKind(kind: string, since: number): Promise<TelemetryEvent[]> {
  if (!redis) return [];
  try {
    // @upstash/redis v1.38 uses zrange(key, min, max, { byScore: true }) for
    // ZRANGEBYSCORE semantics. IMPORTANT: the SDK's automaticDeserialization=true
    // already JSON-parses each member before returning — passing <TelemetryEvent[]>
    // as the type parameter tells the SDK to return parsed objects directly.
    // A previous version used <string[]> + manual JSON.parse(r) which caused a
    // double-parse: the object was coerced to "[object Object]", SyntaxError thrown,
    // and every event silently dropped. The dashboard appeared permanently empty.
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

function cacheHitRate(llmAttempts: TelemetryEvent[]): number {
  let totalInput = 0;
  let cacheRead = 0;
  for (const e of llmAttempts) {
    const attrs = e.attrs as Record<string, unknown>;
    const u = attrs.usage as Record<string, number> | undefined;
    if (u) {
      totalInput += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      cacheRead += u.cache_read_input_tokens ?? 0;
    }
  }
  if (totalInput === 0) return 0;
  return Math.round((cacheRead / totalInput) * 100);
}

function fallbackRate(llmAttempts: TelemetryEvent[]): number {
  if (llmAttempts.length === 0) return 0;
  const fallen = llmAttempts.filter((e) => (e.attrs as Record<string, unknown>).fell_back).length;
  return Math.round((fallen / llmAttempts.length) * 100);
}

function routeCounts(httpRequests: TelemetryEvent[]): Array<{ route: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const e of httpRequests) {
    const route = e.route ?? "unknown";
    counts[route] = (counts[route] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([route, count]) => ({ route, count }));
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtTs(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").replace(/\.\d{3}Z/, " UTC");
}

function truncate(s: unknown, n: number): string {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
}

// ── Tile component ────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  pct,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border-strong/60 bg-bg-surface p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">{label}</span>
      <span className={`text-2xl font-semibold ${accent ? "text-accent" : "text-fg"}`}>{value}</span>
      {sub && <span className="text-[11px] text-fg-subtle">{sub}</span>}
      {pct != null && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div
            className={`h-full rounded-full transition-all ${accent ? "bg-accent" : "bg-fg-muted"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TelemetryDashboard() {
  // Auth is handled by src/proxy.ts (Next 16 Proxy / Middleware) which returns a
  // real HTTP 401 with WWW-Authenticate before this server component ever renders.
  // By the time this code runs, the request is authenticated — no secondary auth
  // check needed here.
  const now = Date.now();
  const since24h = now - 24 * 60 * 60 * 1000;

  // Fetch all 7 kinds in parallel (single pass) then derive sub-views.
  // fetchAll already queries all 7 kinds — previously 4 redundant fetchKind calls
  // doubled the queries to 11. Now we do 7 total and slice in memory.
  const allEvents = await fetchAll(since24h);
  const llmAttempts = allEvents.filter((e) => e.kind === "llm.attempt");
  const httpRequests = allEvents.filter((e) => e.kind === "http.request");
  const clientErrors = allEvents.filter((e) => e.kind === "client.error");
  const serverErrors = allEvents.filter((e) => e.kind === "server.error");

  const errorCount = [...clientErrors, ...serverErrors].length;
  const errorRate = allEvents.length > 0 ? Math.round((errorCount / allEvents.length) * 100) : 0;
  const routes = routeCounts(httpRequests);
  const cacheHit = cacheHitRate(llmAttempts);
  const fallback = fallbackRate(llmAttempts);
  const recentEvents = [...allEvents].reverse().slice(0, 50);

  const redisStatus = redis ? "connected" : "not configured (log-only mode)";

  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-base p-6 font-sans text-fg">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-fg">Anvilry telemetry</h1>
              <p className="mt-0.5 text-xs text-fg-muted">
                Last 24 h · {allEvents.length} events · Redis: {redisStatus}
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
            </span>
          </header>

          {/* Six tiles */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile
              label="Events today"
              value={String(allEvents.length)}
              sub={`${httpRequests.length} requests · ${llmAttempts.length} LLM attempts`}
            />
            <Tile
              label="Cache hit rate"
              value={`${cacheHit}%`}
              sub="cache_read / total input tokens"
              pct={cacheHit}
              accent={cacheHit > 50}
            />
            <Tile
              label="Fallback rate"
              value={`${fallback}%`}
              sub="llm.attempt spans with fell_back=true"
              pct={fallback}
              accent={fallback > 20}
            />
            <Tile
              label="Error rate"
              value={`${errorRate}%`}
              sub={`${errorCount} errors (client + server)`}
              pct={errorRate}
              accent={errorRate > 5}
            />
            <Tile
              label="Client errors"
              value={String(clientErrors.length)}
              sub="frontend boundary + window catches"
            />
            <Tile
              label="Server errors"
              value={String(serverErrors.length)}
              sub="route-level caught exceptions"
              accent={serverErrors.length > 0}
            />
          </div>

          {/* Route breakdown */}
          {routes.length > 0 && (
            <div className="mb-6 rounded-xl border border-border-strong/60 bg-bg-surface p-4">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                Top routes (http.request spans)
              </h2>
              <div className="flex flex-col gap-1.5">
                {routes.map(({ route, count }) => {
                  const pct = Math.round((count / Math.max(1, httpRequests.length)) * 100);
                  return (
                    <div key={route} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 font-mono text-xs text-fg-muted">{route}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
                        <div className="h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-fg-subtle">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent events table */}
          <div className="rounded-xl border border-border-strong/60 bg-bg-surface">
            <div className="border-b border-border-strong/40 px-4 py-3">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                Recent events (last {recentEvents.length} of {allEvents.length})
              </h2>
            </div>
            {recentEvents.length === 0 ? (
              <p className="px-4 py-6 text-sm text-fg-subtle">
                {redis
                  ? "No events in the last 24 hours. Send a chat message to populate."
                  : "Upstash Redis is not configured — events land in Vercel Logs only. Set UPSTASH_REDIS_REST_URL + _TOKEN to enable this view."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-strong/20 text-left font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">Kind</th>
                      <th className="px-4 py-2">Level</th>
                      <th className="px-4 py-2">Route</th>
                      <th className="px-4 py-2">Message / attrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((e, i) => {
                      const isError = e.level === "error";
                      return (
                        <tr
                          key={`${e.ts}-${i}`}
                          className={`border-b border-border-strong/10 ${isError ? "bg-red-500/5" : ""}`}
                        >
                          <td className="px-4 py-2 font-mono text-fg-subtle">{fmtTs(e.ts)}</td>
                          <td className="px-4 py-2 font-mono text-fg">{e.kind}</td>
                          <td className={`px-4 py-2 font-mono ${isError ? "text-red-400" : "text-fg-muted"}`}>
                            {e.level}
                          </td>
                          <td className="px-4 py-2 text-fg-muted">{e.route ?? "—"}</td>
                          <td className="px-4 py-2 text-fg-subtle">
                            {e.message ? (
                              <span className={isError ? "text-red-300" : "text-fg-subtle"}>
                                {truncate(e.message, 80)}
                              </span>
                            ) : (
                              <span className="text-fg-subtle/60">
                                {truncate(JSON.stringify(e.attrs), 80)}
                              </span>
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
      </body>
    </html>
  );
}
