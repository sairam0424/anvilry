import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 25;

/**
 * GET /api/cron/health-check
 *
 * Daily site health check. Probes 13 endpoints in parallel and writes a
 * structured pass/warn/fail result to Redis for the telemetry dashboard.
 *
 * Checks are split by criticality:
 *   P1 — site-breaking if down (homepage, work, projects, sitemap, robots)
 *   P2 — feature-broken (GitHub stats, MCP, llms.txt, feed, about, mcp page)
 *   P3 — degraded (resume.json API)
 *
 * Top-level status:
 *   "fail"  — any P1 check failed
 *   "warn"  — all P1 pass but any P2/P3 failed
 *   "pass"  — all checks passed
 *
 * State-transition alerting: sets anvilry:health:alert:active when status
 * transitions from pass → fail (nx: true prevents alert storms). Auto-clears
 * on recovery. Emits console.error for Vercel Runtime Log integration.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (fail-closed — 401 when unset)
 * Schedule: 0 5 * * * (daily 5am UTC, Hobby-plan compatible)
 * Cost: 0 LLM calls — pure HTTP probing
 */

type CheckResult = {
  status: "pass" | "warn" | "fail";
  http_status: number;
  latency_ms: number;
  detail?: string;
  body_bytes?: number;
};

type HealthResult = {
  run_at: number;
  status: "pass" | "warn" | "fail";
  duration_ms: number;
  release_id: string | null;
  checks: Record<string, CheckResult>;
  p1_pass: boolean;
  p2_pass: boolean;
  total_checks: number;
  failed_checks: number;
  failed_names: string[];
};

const CHECKS = [
  { name: "homepage",         path: "/",                criticality: "P1", timeout: 10_000 },
  { name: "work_listing",     path: "/work",            criticality: "P1", timeout: 10_000 },
  { name: "projects_listing", path: "/projects",        criticality: "P1", timeout: 10_000 },
  { name: "sitemap_xml",      path: "/sitemap.xml",     criticality: "P1", timeout:  8_000 },
  { name: "robots_txt",       path: "/robots.txt",      criticality: "P1", timeout:  8_000 },
  { name: "github_stats_api", path: "/api/github/stats",criticality: "P2", timeout: 10_000 },
  { name: "mcp_get",          path: "/api/mcp/mcp",     criticality: "P2", timeout:  8_000 },
  { name: "llms_txt",         path: "/llms.txt",        criticality: "P2", timeout:  8_000 },
  { name: "llms_full_txt",    path: "/llms-full.txt",   criticality: "P2", timeout:  8_000 },
  { name: "feed_xml",         path: "/feed.xml",        criticality: "P2", timeout:  8_000 },
  { name: "about_page",       path: "/about",           criticality: "P2", timeout:  8_000 },
  { name: "mcp_page",         path: "/mcp",             criticality: "P2", timeout:  8_000 },
  { name: "resume_json_api",  path: "/api/resume.json", criticality: "P3", timeout:  8_000 },
] as const;

async function probe(base: string, check: (typeof CHECKS)[number]): Promise<CheckResult> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${base}${check.path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(check.timeout),
    });
    const latency_ms = Math.round(performance.now() - t0);
    const http_status = res.status;

    if (http_status !== 200) {
      return { status: "fail", http_status, latency_ms };
    }

    // Extra validation per check type
    if (check.name === "github_stats_api") {
      const json = await res.json() as Record<string, unknown>;
      const repoCount = json.repoCount;
      if (typeof repoCount !== "number" || repoCount === 0) {
        return { status: "warn", http_status, latency_ms, detail: "repoCount=0 — GitHub token may be absent or rate-limited" };
      }
      return { status: "pass", http_status, latency_ms };
    }

    if (check.name === "llms_txt" || check.name === "llms_full_txt") {
      const body = await res.text();
      const body_bytes = body.length;
      if (body_bytes < 1000) {
        return { status: "fail", http_status, latency_ms, body_bytes, detail: `body too short (${body_bytes} chars) — corpus may be empty` };
      }
      return { status: "pass", http_status, latency_ms, body_bytes };
    }

    if (check.name === "resume_json_api") {
      const json = await res.json() as Record<string, unknown>;
      if (!json.basics) {
        return { status: "fail", http_status, latency_ms, detail: "missing basics field" };
      }
      return { status: "pass", http_status, latency_ms };
    }

    return { status: "pass", http_status, latency_ms };
  } catch {
    return { status: "fail", http_status: 0, latency_ms: Math.round(performance.now() - t0) };
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const wallStart = performance.now();

  // Run all 13 checks in parallel
  const results = await Promise.all(CHECKS.map((c) => probe(base, c)));

  const checksMap: Record<string, CheckResult> = {};
  for (let i = 0; i < CHECKS.length; i++) {
    checksMap[CHECKS[i].name] = results[i];
  }

  const failedNames = CHECKS
    .filter((_c, i) => results[i].status === "fail")
    .map((c) => c.name);

  const p1Pass = CHECKS
    .filter((c) => c.criticality === "P1")
    .every((c) => checksMap[c.name].status !== "fail");

  const p2Pass = CHECKS
    .filter((c) => c.criticality === "P2")
    .every((c) => checksMap[c.name].status !== "fail");

  const topStatus: "pass" | "warn" | "fail" = !p1Pass
    ? "fail"
    : failedNames.length > 0
      ? "warn"
      : "pass";

  const healthResult: HealthResult = {
    run_at: Date.now(),
    status: topStatus,
    duration_ms: Math.round(performance.now() - wallStart),
    release_id: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    checks: checksMap,
    p1_pass: p1Pass,
    p2_pass: p2Pass,
    total_checks: CHECKS.length,
    failed_checks: failedNames.length,
    failed_names: failedNames,
  };

  if (redis) {
    // State-transition alert: set alert:active only on pass→fail transition (nx supresses storms)
    const prev = await redis.get<string | object>("anvilry:health:latest");
    if (prev) {
      const prevResult = typeof prev === "object" ? prev : JSON.parse(prev as string) as HealthResult;
      if ((prevResult as HealthResult).status === "pass" && topStatus === "fail") {
        await redis.set("anvilry:health:alert:active", "1", { nx: true, ex: 90_000 });
      }
    }
    // Clear alert on recovery
    if (topStatus === "pass") {
      await redis.del("anvilry:health:alert:active");
    }

    // Persist result — 25h TTL ensures stale data self-expires on missed runs
    await redis.set("anvilry:health:latest", JSON.stringify(healthResult), { ex: 90_000 });
  }

  if (topStatus !== "pass") {
    console.error(`[health-check] status=${topStatus} failed=${failedNames.join(",")}`);
  }

  return Response.json(healthResult);
}
