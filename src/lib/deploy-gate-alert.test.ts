import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  ALERT_AUTHOR,
  ISSUE_TITLE_PREFIX,
  buildIssue,
  isCommitSha,
  isDeploymentHost,
  isRunUrl,
  openIssueOnce,
  runAlert,
} from "../../scripts/deploy-gate-alert.mjs";

/**
 * When the post-deploy smoke fails, Vercel keeps the previous deployment serving and the only trace is a
 * commit status. The alert script opens one GitHub issue per held commit so a human notices. Everything it
 * writes into the issue comes from a repository_dispatch payload, so every value is validated before it is
 * printed, and an unvalidated value is dropped, never echoed.
 *
 * The last block pins the shape of deploy-smoke.yml itself: the alert steps must stay best effort and
 * BEFORE the guard step, and no step may be able to hang unbounded (the status action reads a cancelled or
 * skipped step as success).
 */

const SHA = "f60787939b0a05e011c11bd9da06e1e118984b8d";
const URL_OK = "anvilry-abc123-sairams-projects-d50d7437.vercel.app";
const RUN_URL = "https://github.com/sairam0424/anvilry/actions/runs/39780637626";
const REPO = "sairam0424/anvilry";
// Built at runtime so no credential-shaped literal sits in the source.
const FAKE_CREDENTIAL = ["not", "a", "real", "value"].join("-");
const noSleep = async () => {};

describe("validators", () => {
  it("accepts only a 40-hex lowercase commit sha, with nothing before or after it", () => {
    expect(isCommitSha(SHA)).toBe(true);
    expect(isCommitSha(SHA.toUpperCase())).toBe(false);
    expect(isCommitSha(SHA.slice(0, 39))).toBe(false);
    expect(isCommitSha(`${SHA}\n## injected`)).toBe(false);
    expect(isCommitSha(`${SHA}a`)).toBe(false);
    expect(isCommitSha(` ${SHA}`)).toBe(false);
    expect(isCommitSha(`x${SHA}`)).toBe(false);
    expect(isCommitSha(undefined)).toBe(false);
  });

  it("accepts only a *.vercel.app host, with or without https and a trailing slash", () => {
    expect(isDeploymentHost(URL_OK)).toBe(true);
    expect(isDeploymentHost(`https://${URL_OK}/`)).toBe(true);
    expect(isDeploymentHost("https://evil.example.com")).toBe(false);
    expect(isDeploymentHost("https://vercel.app.evil.com")).toBe(false);
    expect(isDeploymentHost(`${URL_OK}/path?x=[a](b)`)).toBe(false);
    expect(isDeploymentHost(`${URL_OK}\n## injected`)).toBe(false);
    expect(isDeploymentHost(`${URL_OK}.evil.com`)).toBe(false);
    expect(isDeploymentHost(`evil.com/${URL_OK}`)).toBe(false);
    expect(isDeploymentHost(`http://${URL_OK}`)).toBe(false);
    expect(isDeploymentHost("")).toBe(false);
  });

  it("accepts only a github.com Actions run url, with nothing before or after it", () => {
    expect(isRunUrl(RUN_URL)).toBe(true);
    expect(isRunUrl("https://github.com/a/b/actions/runs/abc")).toBe(false);
    expect(isRunUrl("https://evil.example.com/a/b/actions/runs/1")).toBe(false);
    expect(isRunUrl(`${RUN_URL}/attempts/1?x=[y](z)`)).toBe(false);
    expect(isRunUrl(`${RUN_URL}\n## injected`)).toBe(false);
    expect(isRunUrl(`x${RUN_URL}`)).toBe(false);
    expect(isRunUrl(undefined)).toBe(false);
  });
});

describe("buildIssue", () => {
  it("names the short commit in the title and states the impact in the body", () => {
    const issue = buildIssue({ sha: SHA, url: URL_OK, runUrl: RUN_URL, outcome: "failure" });
    expect(issue.title).toBe(`${ISSUE_TITLE_PREFIX}f607879`);
    expect(issue.body).toContain(SHA);
    expect(issue.body).toContain(URL_OK);
    expect(issue.body).toContain(RUN_URL);
    expect(issue.body).toContain("failure");
    expect(issue.body).toMatch(/previous deployment keeps serving/i);
    expect(issue.body).toMatch(/Force Promote/);
  });

  it("falls back to an unknown commit and drops every unvalidated value", () => {
    const issue = buildIssue({
      sha: "not-a-sha\n## injected heading",
      url: "https://evil.example.com/[click](https://evil.example.com)",
      runUrl: "javascript:alert(1)",
      outcome: "totally<script>",
    });
    expect(issue.title).toBe(`${ISSUE_TITLE_PREFIX}an unknown commit`);
    expect(issue.body).not.toContain("injected");
    expect(issue.body).not.toContain("evil.example.com");
    expect(issue.body).not.toContain("javascript:");
    expect(issue.body).not.toContain("<script>");
    expect(issue.body).toContain("unknown");
  });
});

type Issue = { title: string; pull_request?: object; user?: { login: string } };
const byBot = (title: string): Issue => ({ title, user: { login: ALERT_AUTHOR } });

/** A fake GitHub that answers the list call with `open` and the create call with `createStatus`. */
function fakeGitHub(open: unknown = [], createStatus = 201) {
  const calls: { method: string; url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    calls.push({ method, url, init });
    if (method === "GET") return new Response(JSON.stringify(open), { status: 200 });
    if (createStatus !== 201) return new Response(JSON.stringify({ message: "Resource not accessible by integration" }), { status: createStatus });
    return new Response(JSON.stringify({ html_url: `https://github.com/${REPO}/issues/401` }), { status: 201 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

/** A fake fetch that plays a fixed sequence of replies, one per call. */
function sequence(replies: (() => Response | Promise<Response>)[]) {
  let n = 0;
  const impl = vi.fn(async () => {
    const reply = replies[n++];
    if (!reply) throw new Error("unexpected extra request");
    return reply();
  });
  return { impl: impl as unknown as typeof fetch, count: () => n };
}

describe("openIssueOnce", () => {
  const issue = buildIssue({ sha: SHA, url: URL_OK, runUrl: RUN_URL, outcome: "failure" });
  const open = (impl: typeof fetch) =>
    openIssueOnce({ repo: REPO, token: FAKE_CREDENTIAL, issue, fetchImpl: impl, sleep: noSleep });

  it("creates the issue when no open issue has the same title", async () => {
    const { impl, calls } = fakeGitHub([byBot("something else")]);
    const result = await open(impl);
    expect(result).toEqual({ created: true, url: `https://github.com/${REPO}/issues/401` });
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toBe(`https://api.github.com/repos/${REPO}/issues`);
    expect(JSON.parse(String(post?.init.body))).toEqual({ title: issue.title, body: issue.body });
  });

  it("sends the request shape GitHub expects: list path and query, version and auth headers, JSON body", async () => {
    const { impl, calls } = fakeGitHub();
    await open(impl);
    const get = calls.find((c) => c.method === "GET");
    const list = new URL(get?.url ?? "");
    expect(list.pathname).toBe(`/repos/${REPO}/issues`);
    expect(list.searchParams.get("state")).toBe("open");
    expect(list.searchParams.get("per_page")).toBe("100");
    const getHeaders = get?.init.headers as Record<string, string>;
    expect(getHeaders.accept).toBe("application/vnd.github+json");
    expect(getHeaders["x-github-api-version"]).toBe("2022-11-28");
    expect(getHeaders["user-agent"]).toMatch(/anvilry/);
    expect(getHeaders.authorization).toBe(`token ${FAKE_CREDENTIAL}`);
    const post = calls.find((c) => c.method === "POST");
    expect((post?.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("does nothing when the alert bot already has an open issue with that title", async () => {
    const { impl, calls } = fakeGitHub([byBot(issue.title)]);
    const result = await open(impl);
    expect(result.created).toBe(false);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("ignores a same-title issue opened by anyone else, so a stranger cannot silence the alert", async () => {
    const { impl, calls } = fakeGitHub([{ title: issue.title, user: { login: "someone-else" } }, { title: issue.title }]);
    const result = await open(impl);
    expect(result.created).toBe(true);
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("ignores a pull request that happens to share the title", async () => {
    const { impl, calls } = fakeGitHub([{ ...byBot(issue.title), pull_request: {} }]);
    const result = await open(impl);
    expect(result.created).toBe(true);
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("fails open when the list reply is not an array: it creates the issue rather than staying silent", async () => {
    const { impl, calls } = fakeGitHub({ message: "unexpected shape" });
    const result = await open(impl);
    expect(result.created).toBe(true);
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("sends the credential only to api.github.com", async () => {
    const { impl, calls } = fakeGitHub();
    await open(impl);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(new URL(c.url).origin).toBe("https://api.github.com");
      expect((c.init.headers as Record<string, string>).authorization).toContain(FAKE_CREDENTIAL);
    }
  });

  it("fails loudly, with GitHub's own message and without the credential, when GitHub refuses", async () => {
    const { impl } = fakeGitHub([], 403);
    const failure = await open(impl).then(
      () => null,
      (error: Error) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect(failure?.message).toMatch(/403/);
    expect(failure?.message).toContain("Resource not accessible by integration");
    expect(failure?.message).not.toContain(FAKE_CREDENTIAL);
  });

  it("retries once after a server error and then succeeds", async () => {
    const list = () => new Response("[]", { status: 200 });
    const created = () => new Response(JSON.stringify({ html_url: `https://github.com/${REPO}/issues/402` }), { status: 201 });
    const { impl, count } = sequence([() => new Response("{}", { status: 502 }), list, created]);
    const result = await open(impl);
    expect(result).toEqual({ created: true, url: `https://github.com/${REPO}/issues/402` });
    expect(count()).toBe(3);
  });

  it("retries once after a network error, then gives up with a clear error", async () => {
    const boom = () => {
      throw new Error("socket hang up");
    };
    const { impl, count } = sequence([boom, boom]);
    await expect(open(impl)).rejects.toThrow(/socket hang up/);
    expect(count()).toBe(2);
  });

  it("does not retry a client error such as 404", async () => {
    const { impl, count } = sequence([() => new Response("{}", { status: 404 })]);
    await expect(open(impl)).rejects.toThrow(/404/);
    expect(count()).toBe(1);
  });
});

describe("runAlert", () => {
  const env = {
    GITHUB_TOKEN: FAKE_CREDENTIAL,
    GITHUB_REPOSITORY: REPO,
    DEPLOYED_SHA: SHA,
    DEPLOYMENT_URL: URL_OK,
    RUN_URL,
    SMOKE_OUTCOME: "failure",
  };

  it("reads its inputs from the environment and opens the issue", async () => {
    const { impl, calls } = fakeGitHub();
    const result = await runAlert(env, impl, noSleep);
    expect(result.created).toBe(true);
    const post = calls.find((c) => c.method === "POST");
    expect(JSON.parse(String(post?.init.body)).title).toBe(`${ISSUE_TITLE_PREFIX}f607879`);
  });

  it("refuses to run without a credential", async () => {
    const { impl } = fakeGitHub();
    await expect(runAlert({ ...env, GITHUB_TOKEN: undefined }, impl, noSleep)).rejects.toThrow(/GITHUB_TOKEN/);
  });

  it.each([["../../etc"], ["a/.."], ["../b"], ["./x"], ["a/b/c"], ["a b/c"], [""], ["owner/"]])(
    "refuses the malformed repository %j",
    async (repository) => {
      const { impl, calls } = fakeGitHub();
      await expect(runAlert({ ...env, GITHUB_REPOSITORY: repository }, impl, noSleep)).rejects.toThrow(/GITHUB_REPOSITORY/);
      expect(calls).toHaveLength(0);
    },
  );
});

describe("command line entry", () => {
  const scriptsDir = fileURLToPath(new URL("../../scripts", import.meta.url));
  const scratch = mkdtempSync(path.join(tmpdir(), "alert-link-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it("runs, and fails with a message, when started through a symlinked path: a silent no-op would read as success", () => {
    symlinkSync(scriptsDir, path.join(scratch, "scripts"));
    const result = spawnSync(process.execPath, [path.join(scratch, "scripts", "deploy-gate-alert.mjs")], {
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/GITHUB_TOKEN/);
  });

  it("runs, and fails with a message, when started by its real path", () => {
    const result = spawnSync(process.execPath, [path.join(scriptsDir, "deploy-gate-alert.mjs")], {
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/GITHUB_TOKEN/);
  });
});

/* ---- deploy-smoke.yml invariants (text-level: the repo has no YAML parser dependency) ---- */

const workflowRaw = readFileSync(
  fileURLToPath(new URL("../../.github/workflows/deploy-smoke.yml", import.meta.url)),
  "utf8",
);
// Comments must not satisfy or defeat an invariant, so match against the file without them.
const workflow = workflowRaw
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");
const [, jobText = ""] = workflow.split(/^jobs:\n/m);
const [jobHeader = "", stepsText = ""] = jobText.split(/^    steps:\n/m);
const steps = stepsText
  .split(/\n(?=      - )/)
  .map((block) => block.trimEnd())
  .filter((block) => block.trim().length > 0);
const stepName = (block: string) => /- name: (.+)/.exec(block)?.[1]?.trim() ?? "";
const timeoutOf = (block: string) => Number(/timeout-minutes:\s*(\d+)/.exec(block)?.[1] ?? NaN);
const guard = steps[steps.length - 1] ?? "";
const alertSteps = steps.filter((s) => /deploy-gate-alert|Checkout the alert script/.test(s));
const ALERT_CONDITION = /if: always\(\) && github\.event_name == 'repository_dispatch' && steps\.smoke\.outcome != 'success'/;

describe("deploy-smoke.yml keeps the gate honest", () => {
  it("names every step, so none can slip past these checks", () => {
    expect(steps.length).toBeGreaterThan(5);
    for (const s of steps) expect(stepName(s), s.slice(0, 60)).not.toBe("");
  });

  it("has the smoke step and ends with the guard that fails the job unless the smoke succeeded", () => {
    expect(steps.some((s) => /id: smoke/.test(s))).toBe(true);
    expect(stepName(guard)).toBe("Fail the status unless the smoke succeeded");
    expect(guard).toMatch(/if: always\(\) && .*steps\.smoke\.outcome != 'success'/);
    expect(guard).toMatch(/exit 1/);
    expect(guard).not.toMatch(/continue-on-error/);
  });

  it("bounds every step, and the sum of the limits stays below the job limit", () => {
    for (const s of steps) expect(timeoutOf(s), stepName(s)).toBeGreaterThan(0);
    const sum = steps.reduce((total, s) => total + timeoutOf(s), 0);
    const job = Number(/^    timeout-minutes:\s*(\d+)/m.exec(jobHeader)?.[1] ?? NaN);
    expect(job).toBeGreaterThan(sum);
  });

  it("never cancels a run, because the status action reads a cancelled job as success", () => {
    expect(workflow).toMatch(/cancel-in-progress: false/);
    expect(workflow).not.toMatch(/cancel-in-progress: true/);
  });

  it("serialises runs per environment and commit, so two dispatches for one commit cannot race the alert", () => {
    expect(workflow).toMatch(/group: deploy-smoke-\$\{\{[^}]*environment[^}]*\}\}-\$\{\{[^}]*git\.sha[^}]*\}\}/);
  });

  it("alerts only on a failed dispatch, best effort, and before the guard", () => {
    expect(alertSteps).toHaveLength(2);
    for (const s of alertSteps) {
      expect(s, stepName(s)).toMatch(ALERT_CONDITION);
      expect(s, stepName(s)).toMatch(/continue-on-error: true/);
      expect(steps.indexOf(s)).toBeLessThan(steps.length - 1);
    }
  });

  it("takes the alert script from the default branch, never from the commit under test", () => {
    const checkout = alertSteps.find((s) => /Checkout the alert script/.test(s)) ?? "";
    expect(checkout).toMatch(/ref: \$\{\{ github\.sha \}\}/);
    expect(checkout).toMatch(/sparse-checkout: scripts\/deploy-gate-alert\.mjs/);
    expect(checkout).toMatch(/path: alert/);
    const run = alertSteps.find((s) => /node alert\/scripts\/deploy-gate-alert\.mjs/.test(s)) ?? "";
    expect(run).toMatch(/GITHUB_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  });

  it("grants exactly the four permissions the job needs and nothing else", () => {
    const block = /^    permissions:\n((?:      .+\n)+)/m.exec(jobHeader)?.[1] ?? "";
    const granted = block
      .split("\n")
      .map((line) => line.trim().split(/\s+#/)[0] ?? "")
      .filter(Boolean)
      .sort();
    expect(granted).toEqual(["actions: read", "contents: read", "issues: write", "statuses: write"]);
  });
});
