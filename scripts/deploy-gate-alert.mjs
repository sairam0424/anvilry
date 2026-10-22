#!/usr/bin/env node
/**
 * Tells a human when the production gate is holding a deployment.
 *
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo DEPLOYED_SHA=... DEPLOYMENT_URL=... RUN_URL=... \
 *   SMOKE_OUTCOME=failure node scripts/deploy-gate-alert.mjs
 *
 * WHY THIS EXISTS
 * When "Post-deploy smoke" fails, Vercel keeps the previous deployment serving and leaves the new one
 * unaliased. The only trace is a red commit status, so a held deploy could sit unnoticed. The workflow
 * .github/workflows/deploy-smoke.yml runs this whenever the smoke step did not succeed (it failed, or it was
 * skipped because an earlier step failed) and opens one GitHub issue per held commit. Dedupe is best effort: a
 * second run for the same commit does not open another while the first issue is open, but a match outside the
 * newest 100 open items, or a create retried after its first attempt succeeded, can leave a duplicate. A
 * deployment held because no status ever arrives is NOT announced.
 *
 * DESIGN RULES (each one is pinned by src/lib/deploy-gate-alert.test.ts)
 *  - Everything in the issue comes from a repository_dispatch payload, so every value is validated first and
 *    an unvalidated value is dropped, never echoed (no markdown injection, no off-site links).
 *  - The workflow takes this file from the default branch, never from the commit under test, so it works
 *    even when the deployed commit predates it.
 *  - Plain Node, no dependencies. The token goes only to api.github.com and never into an error message.
 *  - Dedupe only trusts issues opened by the Actions bot, so a stranger who opens an issue with the same title
 *    cannot silence the alert. One retry after a network error, a 5xx or a 429.
 *  - Best effort: the workflow marks the step continue-on-error, so a failure here can neither hide a failed
 *    smoke nor turn it into a pass. It exits 1 on any API error so the step log says why.
 */
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const ISSUE_TITLE_PREFIX = "Production deployment held: smoke failed for ";
/** Issues created with the workflow's GITHUB_TOKEN are authored by this account. */
export const ALERT_AUTHOR = "github-actions[bot]";

const API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_000;
const ERROR_DETAIL_LIMIT = 200;
const OPEN_ISSUES_PAGE_SIZE = 100;
const SHORT_SHA_LENGTH = 7;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HOST_PATTERN = /^(https:\/\/)?[a-z0-9][a-z0-9-]*\.vercel\.app\/?$/;
const RUN_URL_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+$/;
const REPO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const OUTCOMES = new Set(["failure", "cancelled", "skipped", "success"]);

/** @param {unknown} value */
export function isCommitSha(value) {
  return typeof value === "string" && SHA_PATTERN.test(value);
}

/** A *.vercel.app host, with or without https:// and a trailing slash. @param {unknown} value */
export function isDeploymentHost(value) {
  return typeof value === "string" && HOST_PATTERN.test(value);
}

/** @param {unknown} value */
export function isRunUrl(value) {
  return typeof value === "string" && RUN_URL_PATTERN.test(value);
}

/**
 * @param {{ sha?: string, url?: string, runUrl?: string, outcome?: string }} input
 * @returns {{ title: string, body: string }}
 */
export function buildIssue({ sha, url, runUrl, outcome }) {
  const knownSha = isCommitSha(sha) ? /** @type {string} */ (sha) : null;
  const title = `${ISSUE_TITLE_PREFIX}${knownSha ? knownSha.slice(0, SHORT_SHA_LENGTH) : "an unknown commit"}`;
  const result = outcome && OUTCOMES.has(outcome) ? outcome : "unknown";
  const lines = [
    'The post-deploy gate did not pass, so Vercel is **holding** this production deployment: it is built, but it has not been given the production domain. The previous deployment keeps serving, so nothing is down.',
    "",
    `- Commit: ${knownSha ? `\`${knownSha}\`` : "unknown (the dispatch payload had no valid commit sha)"}`,
    ...(isDeploymentHost(url) ? [`- Deployment: \`${url}\``] : []),
    `- Smoke result: \`${result}\``,
    ...(isRunUrl(runUrl) ? [`- Workflow run: ${runUrl}`] : []),
    "",
    "**What to do**",
    "1. Open the workflow run. Its summary table names the failing check (or says the deployment never became reachable).",
    "2. If the build is bad, fix it and merge. The next production deployment is gated again.",
    "3. If the smoke is wrong or Vercel is stuck, use **Force Promote** on the deployment in the Vercel dashboard, or remove the check (DEPLOY.md, section 8).",
    "",
    "Close this issue once the production domain serves the commit you intended.",
  ];
  return { title, body: lines.join("\n") };
}

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GitHub's own explanation (for example "Resource not accessible by integration"), if the reply has one. @param {Response} res */
async function errorDetail(res) {
  try {
    const data = await res.json();
    return typeof data?.message === "string" ? `: ${data.message.slice(0, ERROR_DETAIL_LIMIT)}` : "";
  } catch {
    return "";
  }
}

/**
 * One request, retried once after a network error, a 5xx or a 429. Errors carry the route and GitHub's message,
 * never the token.
 * @param {{ method: string, path: string, token: string, fetchImpl: typeof fetch, sleep: (ms: number) => Promise<void>, body?: unknown }} request
 */
async function github({ method, path, token, fetchImpl, sleep, body }) {
  /** @type {Record<string, string>} */
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `token ${token}`,
    "user-agent": "anvilry-deploy-gate-alert",
    "x-github-api-version": "2022-11-28",
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  const route = `${method} ${path.split("?")[0]}`;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(`${API}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt === 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new Error(`GitHub API ${route} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (res.ok) return res.json();
    if (attempt === 1 && (res.status >= 500 || res.status === 429)) {
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    throw new Error(`GitHub API ${route} answered ${res.status}${await errorDetail(res)}`);
  }
}

/**
 * Creates the issue unless an open ISSUE (not a pull request) opened by the Actions bot already has the same
 * title. The listing returns the newest 100 open items, pull requests included, so on a very busy tracker the
 * match can be missed and a duplicate opened; a stranger's same-title issue never counts.
 * @param {{ repo: string, token: string, issue: { title: string, body: string }, fetchImpl?: typeof fetch, sleep?: (ms: number) => Promise<void> }} input
 * @returns {Promise<{ created: boolean, url: string }>}
 */
export async function openIssueOnce({ repo, token, issue, fetchImpl = fetch, sleep = defaultSleep }) {
  const open = await github({
    method: "GET",
    path: `/repos/${repo}/issues?state=open&per_page=${OPEN_ISSUES_PAGE_SIZE}&sort=created&direction=desc`,
    token,
    fetchImpl,
    sleep,
  });
  const existing = Array.isArray(open)
    ? open.find((i) => !i.pull_request && i.title === issue.title && i.user?.login === ALERT_AUTHOR)
    : undefined;
  if (existing) return { created: false, url: String(existing.html_url ?? "") };
  const created = await github({
    method: "POST",
    path: `/repos/${repo}/issues`,
    token,
    fetchImpl,
    sleep,
    body: { title: issue.title, body: issue.body },
  });
  return { created: true, url: String(created.html_url ?? "") };
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {typeof fetch} [fetchImpl]
 * @param {(ms: number) => Promise<void>} [sleep]
 */
export async function runAlert(env, fetchImpl = fetch, sleep = defaultSleep) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required to open the alert issue.");
  const repo = env.GITHUB_REPOSITORY ?? "";
  if (!REPO_PATTERN.test(repo)) throw new Error("GITHUB_REPOSITORY must look like owner/name.");
  const issue = buildIssue({
    sha: env.DEPLOYED_SHA,
    url: env.DEPLOYMENT_URL,
    runUrl: env.RUN_URL,
    outcome: env.SMOKE_OUTCOME,
  });
  return openIssueOnce({ repo, token, issue, fetchImpl, sleep });
}

/**
 * True when this file is the program being run. Compares real paths: Node resolves symlinks in import.meta.url,
 * so comparing it with a raw argv[1] would make the CLI silently do nothing, and exit 0, behind a symlink.
 */
function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  runAlert(process.env).then(
    (result) => {
      console.log(result.created ? `Opened ${result.url}` : `An open issue already covers this commit: ${result.url}`);
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
}
