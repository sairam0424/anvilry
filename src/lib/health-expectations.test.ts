import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_STATUS_OVERRIDES,
  expectedStatus,
  isExpectedStatus,
  probeBase,
} from "./health-expectations";

/**
 * BEHAVIOURAL, deliberately. The first version of this guard grepped the cron route's source for
 * `const EXPECTED_STATUS` and `if (http_status !== 200)`. Five different ways of reintroducing the
 * original bug — flipping the default to 405, inverting the comparison operator, ignoring the
 * table, looking the value up by the wrong key, short-circuiting the branch — ALL passed it.
 * Only a literal full revert was caught. It was the same "test that cannot fail" defect it was
 * written to prevent.
 *
 * So the decision logic now lives in a pure module and is exercised, not pattern-matched.
 */
describe("expectedStatus", () => {
  it("defaults every unknown check to 200", () => {
    for (const name of ["homepage", "sitemap_xml", "feed_xml", "does_not_exist", ""]) {
      expect(expectedStatus(name), `${name} should default to 200`).toBe(200);
    }
  });

  it("expects 405 for mcp_get — a plain GET on the Streamable HTTP endpoint", () => {
    expect(expectedStatus("mcp_get")).toBe(405);
  });

  it("overrides exactly one check", () => {
    expect(Object.keys(EXPECTED_STATUS_OVERRIDES)).toEqual(["mcp_get"]);
  });

  it("is not mutable at runtime", () => {
    expect(Object.isFrozen(EXPECTED_STATUS_OVERRIDES)).toBe(true);
  });
});

describe("isExpectedStatus", () => {
  it("passes mcp_get on 405 and fails it on 200", () => {
    expect(isExpectedStatus("mcp_get", 405)).toBe(true);
    // 200 would mean mcp-handler changed GET semantics — that must NOT silently read as healthy.
    expect(isExpectedStatus("mcp_get", 200)).toBe(false);
  });

  it("still fails mcp_get on the statuses that mean real breakage", () => {
    for (const status of [404, 500, 502, 503, 0]) {
      expect(isExpectedStatus("mcp_get", status), `${status} must fail`).toBe(false);
    }
  });

  it("passes ordinary checks only on 200", () => {
    expect(isExpectedStatus("homepage", 200)).toBe(true);
    for (const status of [201, 301, 404, 405, 500]) {
      expect(isExpectedStatus("homepage", status), `${status} must fail`).toBe(false);
    }
  });
});

/**
 * `probeBase` must resolve to the PRODUCTION ALIAS, never the per-deployment host.
 *
 * This is the bug that made the whole mcp_get story wrong. Vercel deployment protection is enabled
 * on this project for everything except custom domains, so the per-deployment host 302s to Vercel
 * SSO — and because `fetch` follows redirects by default, the probe used to read 200 with ~478 KB
 * of `vercel.com/login` HTML. Measured:
 *   https://<deployment>.vercel.app/api/mcp/mcp -> 302 -> follows to 200 (login page, 478,796 B)
 *   https://anvilry.vercel.app/api/mcp/mcp      -> 405 (alias is exempt)
 * So mcp_get was FALSELY PASSING, not failing — and expecting 405 against that host would have
 * turned a false pass into a permanent false failure.
 */
describe("probeBase", () => {
  const saved = {
    prod: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    deployment: process.env.VERCEL_URL,
  };
  const restore = () => {
    if (saved.prod === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    else process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.prod;
    if (saved.deployment === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = saved.deployment;
  };

  it("prefers the production alias over the per-deployment host", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "anvilry.vercel.app";
    process.env.VERCEL_URL = "anvilry-abc123-team.vercel.app";
    expect(probeBase()).toBe("https://anvilry.vercel.app");
    restore();
  });

  it("never returns the per-deployment host when the alias is available", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "anvilry.vercel.app";
    process.env.VERCEL_URL = "anvilry-abc123-team.vercel.app";
    expect(probeBase()).not.toContain("abc123");
    restore();
  });

  it("falls back to the deployment host only when the alias is unset", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_URL = "anvilry-abc123-team.vercel.app";
    expect(probeBase()).toBe("https://anvilry-abc123-team.vercel.app");
    restore();
  });

  it("falls back to localhost off-platform", () => {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(probeBase()).toBe("http://localhost:3000");
    restore();
  });
});

/**
 * The probe must not follow redirects. `redirect: "manual"` is what stops a deployment-protection
 * 302 from being followed to a 200 login page and scored as a healthy app.
 */
describe("probe() redirect handling", () => {
  const raw = readFileSync("src/app/api/cron/health-check/route.ts", "utf8");
  // COMMENT-STRIPPED. The phrase `redirect: "manual"` also appears in the explanatory comment
  // above it, so asserting against the raw source passes even after the real option is deleted —
  // verified by mutation. Assert against code only.
  const route = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/gm, "$1");

  it('sets redirect: "manual" on the probe fetch', () => {
    expect(
      route,
      'probe() must pass redirect: "manual" — with the default "follow", an auth wall reads as 200',
    ).toMatch(/redirect:\s*"manual"/);
  });

  it("treats any 3xx as a failure rather than following it", () => {
    expect(route).toMatch(/http_status\s*>=\s*300\s*&&\s*http_status\s*<\s*400/);
  });

  it("names Vercel SSO specifically, so a responder is not sent chasing the app", () => {
    expect(route).toMatch(/vercel\\?\.com\\?\/\(\?:?sso-api\|login\)|sso-api/);
  });

  it("resolves its base through probeBase, not VERCEL_URL directly", () => {
    expect(route).toMatch(/probeBase\(\)/);
    expect(
      route,
      "route must not read VERCEL_URL directly — that is the protected per-deployment host",
    ).not.toMatch(/process\.env\.VERCEL_URL/);
  });
});

/**
 * The 405 is mcp-handler's behaviour, not ours — it is the unconditional first branch of the
 * streamable-endpoint handler and has nothing to do with this project's `disableSse: true`
 * (that only gates the separate /api/mcp/sse path, which 404s).
 *
 * Pinning the installed version is therefore the only honest coupling: a major bump could answer
 * GET with 200 by opening a notification stream, which the MCP spec permits, and that would
 * silently re-break the check. Asserting `disableSse: true` — which the first version of this
 * guard did — is a tripwire on the wrong wire: it fires on a change that cannot affect the status,
 * and stays green on the upgrade that can.
 */
describe("the 405 expectation's real dependency", () => {
  it("pins the mcp-handler version the 405 was observed from", () => {
    const installed = JSON.parse(
      readFileSync("node_modules/mcp-handler/package.json", "utf8"),
    ) as { version: string };
    expect(
      installed.version,
      `mcp-handler is ${installed.version}, not 1.1.x. GET on the Streamable HTTP endpoint may no ` +
        "longer answer 405 (the MCP spec permits opening a notification stream and returning 200). " +
        "Re-verify with `curl -i <site>/api/mcp/mcp` and update EXPECTED_STATUS_OVERRIDES.mcp_get.",
    ).toMatch(/^1\.1\./);
  });

  it("confirms the 405 branch is still unconditional in the installed package", () => {
    // If this stops matching, mcp-handler restructured its GET handling — revisit the expectation.
    const dist = readFileSync("node_modules/mcp-handler/dist/index.js", "utf8");
    const streamable = dist.slice(dist.indexOf("url.pathname === streamableHttpEndpoint"));
    const getBranch = streamable.slice(0, streamable.indexOf("} else if"));
    expect(getBranch, "no GET branch found on the streamable endpoint").toContain('req.method === "GET"');
    expect(getBranch, "GET on the streamable endpoint no longer writes 405").toContain("writeHead(405)");
    expect(
      getBranch,
      "the 405 is now conditional on something — read it and re-derive the expectation",
    ).not.toContain("disableSse");
  });
});
