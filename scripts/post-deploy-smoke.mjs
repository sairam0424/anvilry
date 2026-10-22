#!/usr/bin/env node
/**
 * Post-deploy smoke: HTTP-level checks against ONE exact Vercel deployment.
 *
 *   node scripts/post-deploy-smoke.mjs <deployment-url>
 *   VERCEL_AUTOMATION_BYPASS_SECRET=... node scripts/post-deploy-smoke.mjs https://anvilry-abc.vercel.app
 *
 * WHY THIS EXISTS
 * CI proves the code on a runner (`pnpm build` + `pnpm start`). It cannot prove the artifact Vercel
 * actually built and is about to serve: the Vercel runtime, the production environment variables
 * (NEXT_PUBLIC_* flags are baked in at build time), the Pagefind index (the LAST build step), the
 * security headers and the fail-closed auth gates. This script checks exactly those, against the
 * deployment's own URL, before Vercel assigns the production domain. The workflow
 * .github/workflows/deploy-smoke.yml runs it on `vercel.deployment.ready` and reports a commit
 * status ("Post-deploy smoke") that a Vercel Deployment Check requires.
 *
 * DESIGN RULES (each one is pinned by src/lib/deploy-smoke.test.ts)
 *  - Plain Node, no dependencies, no install step: it runs in seconds and holds the production
 *    domain for as short a time as possible.
 *  - GET only. It NEVER requests a paid or privileged endpoint (the LLM chat route, the voice
 *    routes, the admin API). The only /api/cron request is an UNAUTHENTICATED probe that must be
 *    refused with 401, which proves the cron routes fail closed.
 *  - The deployment's unique URL sits behind Vercel Authentication, so requests carry the
 *    Protection Bypass for Automation secret as `x-vercel-protection-bypass`. The header goes to
 *    the deployment origin only, redirects are never followed (so it cannot be replayed to another
 *    origin), and the secret is refused for any host that is not *.vercel.app.
 *  - A failure must be loud and specific: every check has an id and a message.
 *
 * Exit code: 0 all checks passed, 1 at least one failed (or the deployment never became
 * reachable), 2 usage error.
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const BYPASS_HEADER = "x-vercel-protection-bypass";

/** Paths this script must never request: they cost money (LLM, speech) or are privileged. */
export const PAID_OR_PRIVILEGED_PATHS = [
  "/api/chat",
  "/api/tts",
  "/api/tts-google",
  "/api/transcribe",
  "/api/admin",
];

const REQUEST_TIMEOUT_MS = 15_000;
const READY_DEADLINE_MS = 120_000;
const MIN_PROJECT_LINKS = 5;
const PROJECT_LINK = /href="(\/projects\/[a-z0-9][a-z0-9-]*)"/g;

/**
 * @typedef {{ status: number, headers: Headers, body: string }} Reply
 * @typedef {{
 *   id: string,
 *   path: string,
 *   dynamic?: "project" | "project-md",
 *   expectStatus?: number | number[],
 *   contentType?: RegExp,
 *   verify?: (reply: Reply, ctx: SmokeContext) => string | null,
 * }} Check
 * @typedef {{ projectPath: string | null }} SmokeContext
 * @typedef {{ id: string, ok: boolean, status: number | null, message: string, ms: number }} CheckResult
 * @typedef {{ ok: boolean, baseUrl: string, results: CheckResult[], failures: CheckResult[], hint?: string }} SmokeResult
 * @typedef {{
 *   fetchImpl?: typeof fetch,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   bypassSecret?: string,
 *   deadlineMs?: number,
 * }} SmokeOptions
 */

/** First `/projects/<slug>` detail link in a page, ignoring the index and `.md` links. @param {string} html */
export function discoverProjectPath(html) {
  const match = new RegExp(PROJECT_LINK.source).exec(html);
  return match ? match[1] : null;
}

/** Distinct project detail links in a page. @param {string} html */
function projectLinks(html) {
  return [...new Set([...html.matchAll(PROJECT_LINK)].map((m) => m[1]))];
}

/** Accepts a bare host (a caller may pass either; the vercel/repository-dispatch README payload example carries the full https URL) or a full URL; returns the origin. @param {string} raw */
export function normalizeDeploymentUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) throw new Error("A deployment URL is required.");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withScheme);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported URL scheme "${url.protocol}" in "${value}".`);
  }
  return url.origin;
}

/**
 * The automation secret skips Vercel's deployment protection, so it must only ever reach a Vercel
 * deployment host. Anything else is refused before a single request is made.
 * @param {string} baseUrl @param {string | undefined} secret
 */
export function assertBypassTargetAllowed(baseUrl, secret) {
  if (!secret) return;
  const { hostname } = new URL(baseUrl);
  if (!hostname.endsWith(".vercel.app")) {
    throw new Error(`Refusing to send the protection-bypass secret to "${hostname}": only *.vercel.app hosts are allowed.`);
  }
}

/**
 * True for Vercel's Authentication wall as an unauthenticated client sees it: a 401/403, or (the
 * usual case for a protected deployment URL) a redirect to vercel.com/sso-api.
 * @param {Reply} reply
 */
function isAuthWall(reply) {
  if (reply.status === 401 || reply.status === 403) return true;
  if (reply.status >= 300 && reply.status < 400) return /^https:\/\/vercel\.com\/sso-api/i.test(reply.headers.get("location") ?? "");
  return false;
}

/** @param {number | number[] | undefined} expected @returns {number[]} */
function expectedStatuses(expected) {
  if (expected === undefined) return [200];
  return Array.isArray(expected) ? expected : [expected];
}

/** @type {Check[]} */
export const CHECKS = [
  {
    id: "home",
    path: "/",
    contentType: /text\/html/,
    verify: (r) => (r.body.includes("Sairam Ugge") ? null : 'the home page does not contain "Sairam Ugge"'),
  },
  {
    id: "security-headers",
    path: "/",
    verify: (r) => {
      const h = r.headers;
      if (!h.get("content-security-policy")) return "no enforced Content-Security-Policy header (report-only does not count)";
      if (!/frame-ancestors/i.test(h.get("content-security-policy") ?? "")) return "the CSP has no frame-ancestors directive";
      if ((h.get("x-frame-options") ?? "").toUpperCase() !== "DENY") return `X-Frame-Options is "${h.get("x-frame-options")}", expected DENY`;
      if ((h.get("x-content-type-options") ?? "").toLowerCase() !== "nosniff") return "X-Content-Type-Options is not nosniff";
      if (!h.get("referrer-policy")) return "no Referrer-Policy header";
      return null;
    },
  },
  {
    id: "projects-index",
    path: "/projects",
    contentType: /text\/html/,
    verify: (r) => {
      const links = projectLinks(r.body).length;
      return links >= MIN_PROJECT_LINKS ? null : `only ${links} project detail link(s) found, expected at least ${MIN_PROJECT_LINKS}`;
    },
  },
  {
    id: "project-detail",
    path: "/projects/:slug",
    dynamic: "project",
    contentType: /text\/html/,
    verify: (r) => (/<h1[\s>]/.test(r.body) ? null : "the project page has no <h1>"),
  },
  {
    id: "project-md",
    path: "/projects/:slug.md",
    dynamic: "project-md",
    contentType: /text\/markdown/,
  },
  { id: "project-missing-404", path: "/projects/does-not-exist-smoke-check", expectStatus: 404 },
  { id: "work", path: "/work", contentType: /text\/html/ },
  { id: "about", path: "/about", contentType: /text\/html/ },
  { id: "decisions", path: "/decisions", contentType: /text\/html/ },
  { id: "resume", path: "/resume", contentType: /text\/html/ },
  { id: "mcp", path: "/mcp", contentType: /text\/html/ },
  { id: "search", path: "/search", contentType: /text\/html/ },
  {
    id: "pagefind",
    path: "/pagefind/pagefind.js",
    contentType: /javascript/,
    verify: (r) => (r.body.length > 0 ? null : "the Pagefind script is empty (the search index step did not run)"),
  },
  {
    id: "llms-txt",
    path: "/llms.txt",
    contentType: /text\/plain/,
    verify: (r) => (r.body.includes("Sairam Ugge") ? null : "llms.txt does not name the site owner"),
  },
  {
    id: "sitemap",
    path: "/sitemap.xml",
    contentType: /xml/,
    verify: (r) => (r.body.includes("<urlset") ? null : "sitemap.xml has no <urlset>"),
  },
  {
    id: "robots",
    path: "/robots.txt",
    contentType: /text\/plain/,
    verify: (r) => (/sitemap:/i.test(r.body) ? null : "robots.txt does not point at the sitemap"),
  },
  {
    id: "resume-json",
    path: "/api/resume.json",
    contentType: /json/,
    verify: (r) => {
      let data;
      try {
        data = JSON.parse(r.body);
      } catch {
        return "the response is not valid JSON";
      }
      const n = Array.isArray(data?.projects) ? data.projects.length : 0;
      return n >= MIN_PROJECT_LINKS ? null : `resume.json lists ${n} project(s), expected at least ${MIN_PROJECT_LINKS}`;
    },
  },
  // Fail-closed gates. Both are UNAUTHENTICATED probes that must be refused; neither runs any work.
  { id: "admin-gated", path: "/admin/telemetry", expectStatus: [401, 404] },
  { id: "cron-fail-closed", path: "/api/cron/health-check", expectStatus: 401 },
  { id: "not-found", path: "/smoke-no-such-page", expectStatus: 404 },
];

/**
 * @param {string} baseUrl
 * @param {SmokeOptions & { path: string }} opts
 * @returns {Promise<Reply>}
 */
async function request(baseUrl, { path, fetchImpl = fetch, bypassSecret }) {
  /** @type {Record<string, string>} */
  const headers = { accept: "*/*", "user-agent": "anvilry-post-deploy-smoke" };
  if (bypassSecret) headers[BYPASS_HEADER] = bypassSecret;
  const res = await fetchImpl(`${baseUrl}${path}`, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls the deployment root until it answers with something that retrying cannot improve: a 2xx/3xx,
 * or a 401/403 (the protection wall is reachable, and waiting will not lift it). 5xx, 404 and network
 * errors are retried with a growing delay until the deadline.
 * @param {string} baseUrl
 * @param {SmokeOptions} [opts]
 */
export async function waitUntilReachable(baseUrl, opts = {}) {
  const { fetchImpl = fetch, sleep = defaultSleep, now = Date.now, bypassSecret, deadlineMs = READY_DEADLINE_MS } = opts;
  const startedAt = now();
  let delay = 2_000;
  for (;;) {
    try {
      const { status } = await request(baseUrl, { path: "/", fetchImpl, bypassSecret });
      if (status < 500 && status !== 404) return true;
    } catch {
      // network error: the deployment is not accepting connections yet
    }
    if (now() - startedAt + delay > deadlineMs) return false;
    await sleep(delay);
    delay = Math.min(delay * 2, 15_000);
  }
}

/** @param {Check} check @param {SmokeContext} ctx */
function resolvePath(check, ctx) {
  if (!check.dynamic) return check.path;
  if (!ctx.projectPath) return null;
  return check.dynamic === "project-md" ? `${ctx.projectPath}.md` : ctx.projectPath;
}

/**
 * @param {string} baseUrl
 * @param {SmokeOptions} [opts]
 * @returns {Promise<SmokeResult>}
 */
export async function runSmoke(baseUrl, opts = {}) {
  const { fetchImpl = fetch, sleep = defaultSleep, now = Date.now, bypassSecret } = opts;
  const base = normalizeDeploymentUrl(baseUrl);
  /** @type {SmokeContext} */
  const ctx = { projectPath: null };
  /** @type {CheckResult[]} */
  const results = [];
  /** @type {Reply[]} */
  const replies = [];

  const reachable = await waitUntilReachable(base, { fetchImpl, sleep, now, bypassSecret, deadlineMs: opts.deadlineMs });
  if (!reachable) {
    const failure = { id: "reachable", ok: false, status: null, message: `${base} never answered within the readiness deadline`, ms: 0 };
    return { ok: false, baseUrl: base, results: [failure], failures: [failure] };
  }

  for (const check of CHECKS) {
    const startedAt = now();
    const finish = (/** @type {boolean} */ ok, /** @type {number | null} */ status, /** @type {string} */ message) => {
      results.push({ id: check.id, ok, status, message, ms: Math.max(0, now() - startedAt) });
    };
    const path = resolvePath(check, ctx);
    if (path === null) {
      finish(false, null, "no project link was discovered on /projects, so this check cannot run");
      continue;
    }
    try {
      const reply = await request(base, { path, fetchImpl, bypassSecret });
      replies.push(reply);
      const allowed = expectedStatuses(check.expectStatus);
      if (!allowed.includes(reply.status)) {
        finish(false, reply.status, `${path} answered ${reply.status}, expected ${allowed.join(" or ")}`);
        continue;
      }
      const type = reply.headers.get("content-type") ?? "";
      if (check.contentType && !check.contentType.test(type)) {
        finish(false, reply.status, `${path} content-type is "${type}", expected ${check.contentType}`);
        continue;
      }
      if (check.id === "projects-index") ctx.projectPath = discoverProjectPath(reply.body);
      const problem = check.verify ? check.verify(reply, ctx) : null;
      finish(problem === null, reply.status, problem ?? "ok");
    } catch (error) {
      finish(false, null, `${path} could not be fetched: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const failures = results.filter((r) => !r.ok);
  /** @type {SmokeResult} */
  const result = { ok: failures.length === 0, baseUrl: base, results, failures };
  const walled = replies.length > 0 && replies.filter(isAuthWall).length >= Math.ceil(replies.length / 2);
  if (!result.ok && walled) {
    result.hint =
      "Most responses were a 401/403 or a redirect to vercel.com/sso-api: the deployment is behind Vercel Authentication. Check that the GitHub Actions secret " +
      "VERCEL_AUTOMATION_BYPASS_SECRET exists, matches the project's Protection Bypass for Automation secret, and was not " +
      "rotated without a redeploy.";
  }
  return result;
}

/** @param {SmokeResult} result */
function render(result) {
  const lines = [`Post-deploy smoke: ${result.ok ? "PASS" : "FAIL"} (${result.results.filter((r) => r.ok).length}/${result.results.length}) ${result.baseUrl}`];
  for (const r of result.results) lines.push(`  ${r.ok ? "ok  " : "FAIL"}  ${r.id.padEnd(20)} ${r.status ?? "-"}  ${r.ok ? "" : r.message}`);
  if (result.hint) lines.push("", `hint: ${result.hint}`);
  return lines.join("\n");
}

/** @param {SmokeResult} result */
function renderMarkdown(result) {
  const rows = result.results.map((r) => `| ${r.ok ? "pass" : "**FAIL**"} | \`${r.id}\` | ${r.status ?? "-"} | ${r.ok ? "" : r.message.replaceAll("|", "\\|")} |`);
  return [
    `### Post-deploy smoke: ${result.ok ? "pass" : "FAIL"}`,
    "",
    `Deployment: \`${result.baseUrl}\``,
    "",
    "| Result | Check | Status | Detail |",
    "|---|---|---|---|",
    ...rows,
    ...(result.hint ? ["", `> ${result.hint}`] : []),
    "",
  ].join("\n");
}

async function main() {
  const raw = process.argv[2] ?? process.env.DEPLOYMENT_URL ?? "";
  if (!raw) {
    console.error("usage: node scripts/post-deploy-smoke.mjs <deployment-url>");
    process.exit(2);
  }
  let base;
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || undefined;
  try {
    base = normalizeDeploymentUrl(raw);
    assertBypassTargetAllowed(base, secret);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  // Hard stop well inside the workflow's job timeout, so a hang is a FAILED step (which the status
  // action reports as failure) and never a cancelled job.
  const hardStop = setTimeout(() => {
    console.error("Post-deploy smoke exceeded its hard time limit.");
    process.exit(1);
  }, 270_000);
  const result = await runSmoke(base, { bypassSecret: secret });
  clearTimeout(hardStop);
  console.log(render(result));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderMarkdown(result));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
