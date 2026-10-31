import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_V1_BASE, DEPRECATION_NOTICE_DAYS, RATE_LIMIT_POLICY } from "./api-policy";
import { API_CATALOG_PATH } from "./api-catalog";
import { buildLlmsTxt } from "./llms-txt";
import { PAGE_TWINS } from "./page-twins";

/**
 * llms.txt is the discovery surface AI agents read to find the MCP server, so the endpoint
 * it advertises has to be one that actually answers. The route sets `disableSse: true`
 * (src/app/api/mcp/[transport]/route.ts), which 404s the legacy /sse path deliberately —
 * advertising it sends every agent to a dead transport.
 */
describe("buildLlmsTxt — advertised MCP endpoint", () => {
  const txt = buildLlmsTxt();

  it("advertises the Streamable HTTP transport, not the disabled SSE one", () => {
    // Anchor on the exact line prefix. `includes("MCP server")` matched the FIRST line
    // containing that phrase, and every content section is interpolated ABOVE the Links
    // section — so a project summary mentioning "MCP server" would fail a code test.
    const line = txt
      .split("\n")
      .find((l) => l.startsWith("- MCP server (for AI agents):"));
    expect(
      line,
      "llms.txt should advertise an MCP server in its Links section",
    ).toBeDefined();
    expect(line).toContain("/api/mcp/mcp");
  });

  it("never mentions /api/mcp/sse anywhere — the route 404s that path on purpose", () => {
    expect(txt).not.toContain("/api/mcp/sse");
  });

  it("stays consistent with the route's disableSse setting", () => {
    // Guard the coupling itself: if someone re-enables SSE, this test should be revisited
    // rather than silently diverging from llms.txt again.
    const route = readFileSync("src/app/api/mcp/[transport]/route.ts", "utf8");
    const sseDisabled = /disableSse:\s*true/.test(route);
    expect(
      sseDisabled,
      "route no longer disables SSE — re-check what llms.txt should advertise",
    ).toBe(true);
    expect(txt).toContain("/api/mcp/mcp");
  });
});

describe("buildLlmsTxt — AI Usage Policy", () => {
  const txt = buildLlmsTxt();

  it("includes an AI Usage Policy section", () => {
    expect(txt).toContain("## AI Usage Policy");
  });

  it("frames the policy as a stated preference, not an enforced block", () => {
    const section = txt.split("## AI Usage Policy")[1] ?? "";
    // Must not claim this technically blocks or prevents AI training —
    // only that it's a stated preference under an existing convention.
    expect(section.toLowerCase()).not.toMatch(/blocks? (ai )?training/);
    expect(section.toLowerCase()).toMatch(/preference|signal/);
  });

  it("references the existing LICENSE content-exclusion terms", () => {
    const section = txt.split("## AI Usage Policy")[1] ?? "";
    expect(section.toLowerCase()).toContain("license");
  });
});

describe("buildLlmsTxt — instructions for agents", () => {
  const txt = buildLlmsTxt();
  const section = (name: string) => {
    const after = txt.split(`## ${name}\n`)[1] ?? "";
    return after.split(/\n## /)[0];
  };

  it("has a 'When to use this site' section ahead of the content lists", () => {
    expect(txt).toContain("## When to use this site\n");
    expect(txt.indexOf("## When to use this site")).toBeLessThan(txt.indexOf("## Production Work"));
  });

  it("says what the site is good for and what to use something else for", () => {
    const body = section("When to use this site");
    expect(body).toMatch(/use this site when/i);
    expect(body).toMatch(/do not use/i);
    expect(body.length).toBeGreaterThan(300);
  });

  it("tells an agent how to fetch each representation", () => {
    const body = section("How to read this site");
    expect(body).toContain("Accept: text/markdown");
    expect(body).toContain(".md");
    expect(body).toContain("/api/resume.json");
    expect(body).toContain("/openapi.json");
    expect(body).toContain("/developers");
    expect(body).toContain("/api/mcp/mcp");
  });

  it("links the developer guide, OpenAPI document, contact and privacy pages", () => {
    const links = section("Links");
    for (const path of ["/developers", "/openapi.json", "/contact", "/privacy"]) {
      expect(links).toContain(`https://anvilry.vercel.app${path}`);
    }
  });

  it("does not add a second MCP line that starts like the advertised one", () => {
    const starts = txt.split("\n").filter((l) => l.startsWith("- MCP server (for AI agents):"));
    expect(starts).toHaveLength(1);
  });
});

describe("buildLlmsTxt — developer resources", () => {
  const BASE = "https://anvilry.vercel.app";
  const txt = buildLlmsTxt();
  const block = (txt.split("## Developer resources\n")[1] ?? "").split(/\n## /)[0];
  const lines = block.split("\n").filter((l) => l.startsWith("- "));

  it("has a 'Developer resources' section ahead of the content lists", () => {
    expect(txt).toContain("## Developer resources\n");
    expect(txt.indexOf("## Developer resources")).toBeLessThan(txt.indexOf("## Production Work"));
    expect(txt.indexOf("## How to read this site")).toBeLessThan(txt.indexOf("## Developer resources"));
  });

  it("names every resource with the product name, so a search by name finds it", () => {
    expect(lines.length).toBeGreaterThanOrEqual(8);
    for (const line of lines) expect(line, line).toMatch(/^- Anvilry /);
  });

  it("lists API documentation, the OpenAPI specification, the versioned API, MCP and authentication", () => {
    expect(block).toContain(`- Anvilry API documentation: ${BASE}/developers\n`);
    expect(block).toContain(`- Anvilry OpenAPI specification (OpenAPI 3.1, JSON): ${BASE}/openapi.json\n`);
    expect(block).toContain(`base URL: ${BASE}${API_V1_BASE}\n`);
    expect(block).toContain(`- Anvilry MCP server: ${BASE}/mcp (Streamable HTTP endpoint ${BASE}/api/mcp/mcp)`);
    expect(block).toMatch(/- Anvilry authentication: none, no API keys/);
    expect(block).toContain(`- Anvilry API catalog (RFC 9727): ${BASE}${API_CATALOG_PATH}\n`);
  });

  it("lists SDK and command-line use at their anchors and says plainly that neither is published", () => {
    const sdk = lines.find((l) => l.startsWith("- Anvilry SDK and client libraries:")) ?? "";
    const cli = lines.find((l) => l.startsWith("- Anvilry command-line use:")) ?? "";
    expect(sdk).toContain(`${BASE}/developers#sdk`);
    expect(sdk).toMatch(/no official SDK/i);
    expect(cli).toContain(`${BASE}/developers#cli`);
    expect(cli).toMatch(/no published CLI/i);
    expect(`${sdk}${cli}`).not.toMatch(/npm (install|i) |pip install |go get |brew install /i);
  });

  it("prints the published numbers, not copies of them", () => {
    expect(block).toContain(`${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds`);
    expect(block).toContain(`at least ${DEPRECATION_NOTICE_DAYS} days`);
  });

  it("points only at anchors the developer guide really has", () => {
    const guide = readFileSync("src/app/developers/page.tsx", "utf8");
    const anchors = [...block.matchAll(/\/developers#([a-z-]+)/g)].map((m) => m[1]);
    expect(anchors.length).toBeGreaterThanOrEqual(6);
    for (const anchor of anchors) expect(guide, `#${anchor}`).toContain(`id="${anchor}"`);
  });

  it("keeps the command-line mention the rest of the file already carried", () => {
    const rest = txt.replace(block, "");
    expect(rest).toMatch(/\bCLI\b/);
  });
});

describe("buildLlmsTxt — Markdown versions of pages", () => {
  const BASE = "https://anvilry.vercel.app";
  const txt = buildLlmsTxt();
  const pages = (txt.split("### Pages\n")[1] ?? "").split(/\n#{2,3} /)[0];

  it("tells an agent that the pages themselves have a .md URL", () => {
    const how = (txt.split("## How to read this site\n")[1] ?? "").split(/\n## /)[0];
    expect(how).toContain(`${BASE}/about.md`);
  });

  it("lists the .md URL of every page that has a twin, whatever the notes flag", () => {
    for (const page of PAGE_TWINS.filter((p) => p !== "notes")) {
      expect(pages, page).toContain(`- ${BASE}/${page}.md\n`);
    }
    for (const page of ["resume", "search", "stats"]) expect(pages, page).not.toContain(`/${page}.md`);
  });
});

/**
 * NEXT_PUBLIC_NOTES_ENABLED is inlined when the content layer loads and a deployment may set it
 * (this project's Vercel preview does), so these cases stub the flag, reset the module graph and
 * import the generator afresh: the answer depends on the case, never on the environment of the run.
 */
describe("buildLlmsTxt — the /notes Markdown URL follows the notes flag", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function pagesWithNotes(enabled: boolean): Promise<string> {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", enabled ? "true" : "false");
    const { buildLlmsTxt: build } = await import("./llms-txt");
    return (build().split("### Pages\n")[1] ?? "").split(/\n#{2,3} /)[0];
  }

  it("omits /notes.md while the section ships dark, because that page and its twin are a 404", async () => {
    expect(await pagesWithNotes(false)).not.toContain("/notes.md");
  });

  it("lists /notes.md once the section is switched on", async () => {
    expect(await pagesWithNotes(true)).toContain("- https://anvilry.vercel.app/notes.md\n");
  });
});
