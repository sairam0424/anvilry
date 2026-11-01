import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/lib/api-error";
import { groupArticles } from "@/lib/article-grouping";
import {
  API_V1_BASE,
  RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICY_TEXT,
  VERSIONING_POLICY,
} from "@/lib/api-policy";
import {
  allArticles,
  allProjects,
  allWork,
  publicProjects,
  repoLink,
} from "@/lib/content";
import { CLI, cliHeading, cliStatus } from "@/lib/developer-tools";
import { allDecisions } from "@/lib/decisions";
import { buildOpenApiDocument, listOperations } from "@/lib/openapi";
import { PAGE_TWINS, type PageTwin } from "@/lib/page-twins";
import { PRIVACY_FACTS } from "@/lib/privacy-facts";
import { achievements, impactMetrics, profile, skills } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";
import { buildPageMarkdown, markdownForPage } from "./page-markdown";

/**
 * Every page twin is built from the data its page renders, so these tests check facts that come
 * from the data sources (not copies of the page text) plus the invariants every twin shares.
 */

/** Notes ship dark: the /notes page is a 404 and so is its twin (checked separately below). */
const PAGES_WITH_TWIN = PAGE_TWINS.filter((page) => page !== "notes");

const FENCE = /^(`{3,}).*\n[\s\S]*?\n\1$/gm;
/** Text outside fenced blocks and inline code spans, where `<query>` in a usage line is not a tag. */
const outsideCode = (md: string) => md.replace(FENCE, "").replace(/`[^`\n]+`/g, "");
/** Markdown escapes (a backslash before a symbol) are the converter's, not part of the facts. */
const plain = (md: string) => md.replace(/\\([\\*[\]`<>#|.+)-])/g, "$1");

const twins = new Map<PageTwin, string>();

beforeAll(async () => {
  for (const page of PAGES_WITH_TWIN) {
    const md = await buildPageMarkdown(page);
    expect(md, `${page} twin`).not.toBeNull();
    twins.set(page, md as string);
  }
});

const twin = (page: PageTwin) => twins.get(page) as string;

describe.each(PAGES_WITH_TWIN)("the %s twin", (page) => {
  it("starts with a top-level heading and has only one", () => {
    const md = twin(page);
    expect(md.startsWith("# ")).toBe(true);
    expect(outsideCode(md).match(/^# /gm)).toHaveLength(1);
  });

  it("contains no HTML tags or attributes outside code blocks", () => {
    expect(outsideCode(twin(page))).not.toMatch(
      /<\/?[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i,
    );
    expect(outsideCode(twin(page))).not.toMatch(/\bclassName=|\bclass="/);
  });

  it("links with absolute URLs only", () => {
    const md = outsideCode(twin(page));
    expect(md).not.toMatch(/\]\(\//);
    expect(md).not.toMatch(/\]\(#/);
  });

  it("says where the HTML page is", () => {
    expect(twin(page)).toContain(`[${SITE_URL}/${page}](${SITE_URL}/${page})`);
  });

  it("ends with a newline and has no run of blank lines", () => {
    expect(twin(page).endsWith("\n")).toBe(true);
    expect(twin(page)).not.toMatch(/\n{3,}/);
  });
});

describe("the about twin", () => {
  it("carries the identity, availability, impact, skills and achievements the page is built from", () => {
    const md = plain(twin("about"));
    expect(md).toContain(`# About ${profile.name}`);
    expect(md).toContain(profile.role);
    expect(md).toContain(profile.company);
    expect(md).toContain(profile.availability);
    for (const m of impactMetrics)
      expect(md, m.sub).toContain(`**${m.value}** ${m.label} (${m.sub})`);
    for (const group of skills) {
      expect(md).toContain(`**${group.group}:** ${group.items.join(", ")}`);
    }
    for (const a of achievements) expect(md).toContain(a.title);
    expect(md).toContain(`${publicProjects.length} public repositories`);
  });
});

describe("the contact twin", () => {
  it("lists the same ways to reach the owner as the page", () => {
    const md = plain(twin("contact"));
    expect(md).toContain(profile.email);
    expect(md).toContain(profile.calendlyUrl);
    expect(md).toContain(profile.links.linkedin);
    expect(md).toContain(profile.links.github);
    expect(md).toContain(`[developer guide](${SITE_URL}/developers)`);
  });
});

describe("the projects twin", () => {
  it("lists every project under its group with its Markdown URL, and never links a private repository", () => {
    const md = plain(twin("projects"));
    for (const p of allProjects) {
      expect(md, p.slug).toContain(`[${p.name}](${SITE_URL}${p.url})`);
      expect(md, p.slug).toContain(`${SITE_URL}${p.url}.md`);
      const repo = repoLink(p);
      if (repo === null) expect(md).not.toContain(p.repo);
      else expect(md, p.slug).toContain(repo);
    }
    expect(md).toContain("Private repository");
    expect(md).toContain(`${allProjects.length} projects`);
    expect(md).toContain(`${publicProjects.length} have public repositories`);
  });
});

describe("the work twin", () => {
  it("lists every case study with its register, role and metrics", () => {
    const md = plain(twin("work"));
    for (const w of allWork) {
      expect(md, w.slug).toContain(`[${w.name}](${SITE_URL}${w.url})`);
      expect(md, w.slug).toContain(w.register);
      expect(md, w.slug).toContain(w.role);
      for (const m of w.metrics)
        expect(md, `${w.slug}:${m.label}`).toContain(
          `**${m.value}** ${m.label}`,
        );
    }
  });
});

describe("the decisions twin", () => {
  it("lists every decision of the ledger with its source", () => {
    const md = plain(twin("decisions"));
    expect(md).toContain(`${allDecisions.length} decisions`);
    for (const d of allDecisions) {
      expect(md, d.id).toContain(d.title);
      expect(md, d.id).toContain(`${SITE_URL}${d.href}`);
    }
  });
});

describe("the articles twin", () => {
  it("lists one entry per group of the same article, linked to where it is read", () => {
    expect(allArticles.length).toBeGreaterThan(0);
    const md = plain(twin("articles"));
    expect(md).toContain("# Articles");
    const groups = groupArticles(allArticles);
    expect(groups.length).toBeLessThan(allArticles.length);
    for (const { canonical } of groups) {
      expect(md, canonical.slug).toContain(`[${canonical.title}](`);
      expect(md, canonical.slug).toContain(canonical.summary);
    }
    expect(outsideCode(md).match(/^- \[/gm)).toHaveLength(groups.length);
  });
});

describe("the developers twin", () => {
  const md = () => plain(twin("developers"));

  it("documents every operation of the OpenAPI document with its path and operationId", () => {
    for (const { path, operation } of listOperations(buildOpenApiDocument())) {
      expect(md(), operation.operationId).toContain(operation.operationId);
      expect(md(), path).toContain(path);
    }
  });

  it("documents every error code", () => {
    for (const { code, status } of API_ERROR_CODES) {
      expect(md()).toContain(code);
      expect(md()).toContain(String(status));
    }
  });

  it("states authentication, versioning, rate limits, SDK and command-line use under their own headings", () => {
    const headings = outsideCode(md())
      .split("\n")
      .filter((l) => /^#{2,3} /.test(l));
    for (const wanted of [
      /Authentication/,
      /Versioning/,
      /Rate limits/,
      /Anvilry SDK and client libraries/,
      new RegExp(cliHeading(CLI)),
    ]) {
      expect(
        headings.some((h) => wanted.test(h)),
        String(wanted),
      ).toBe(true);
    }
  });

  it("prints the published policy sentences and numbers, not copies of them", () => {
    for (const sentence of [...VERSIONING_POLICY, ...RATE_LIMIT_POLICY_TEXT]) {
      expect(md()).toContain(plain(sentence));
    }
    expect(md()).toContain(
      `${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds`,
    );
  });

  it("documents every response header of the contract", () => {
    for (const header of [
      "RateLimit-Policy",
      "RateLimit",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "Retry-After",
      "API-Version",
      "Deprecation",
      "Sunset",
    ]) {
      expect(md(), header).toContain(`| ${header} |`);
    }
  });

  it("says plainly that there is no official SDK, says about the CLI what CLI.published says, and invents no package name", () => {
    expect(md()).toMatch(/no official SDK/i);
    expect(md()).toContain(cliStatus(CLI));
    // npm install is allowed only as the CLI's own documented install command, once it is published.
    expect(md().replace(CLI.installCommand, "")).not.toMatch(/npm (install|i) /i);
    expect(md()).not.toMatch(/pip install |go get |brew install /i);
    if (!CLI.published) expect(md()).not.toMatch(/npx anvilry/);
    expect(md()).toContain(`${SITE_URL}${API_V1_BASE}`);
  });

  it("claims about Vary only what is provable: Markdown responses carry it, and the HTML page links its twin", () => {
    expect(md()).toContain("Markdown responses carry `Vary: Accept`.");
    expect(md()).toContain('The HTML page of each also points to its Markdown version with a `Link` header (`rel="alternate"`).');
    expect(md()).not.toMatch(/caches keep the two apart/i);
  });

  it("keeps the runnable curl examples of the page", () => {
    expect(twin("developers")).toContain(`curl -sS ${SITE_URL}/openapi.json`);
    expect(twin("developers")).toContain(
      `curl -sS -H 'Accept: text/markdown' ${SITE_URL}/`,
    );
  });
});

describe("the mcp twin", () => {
  it("names the endpoint, the client configuration and every tool the server registers", () => {
    const md = plain(twin("mcp"));
    expect(md).toContain(`${SITE_URL}/api/mcp/mcp`);
    expect(md).toContain('"mcpServers"');
    const route = readFileSync("src/app/api/mcp/[transport]/route.ts", "utf8");
    const tools = [
      ...route.matchAll(/server\.registerTool\(\s*"([A-Za-z0-9_]+)"/g),
    ].map((m) => m[1]);
    expect(tools.length).toBeGreaterThanOrEqual(10);
    for (const tool of tools) expect(md, tool).toContain(`| ${tool} |`);
  });

  it("is titled with the product name", () => {
    expect(twin("mcp")).toMatch(/^# .*Anvilry MCP server/);
  });
});

describe("the privacy twin", () => {
  const md = () => plain(twin("privacy"));

  it("prints every number the page is pinned to in privacy-facts", () => {
    const F = PRIVACY_FACTS;
    expect(md()).toContain(`last ${F.chatMessagesKept} messages`);
    expect(md()).toContain(`${F.chatCharsPerMessage} characters`);
    expect(md()).toContain(`${F.faqCacheHours} hours`);
    expect(md()).toContain(
      `${F.rateLimitRequests} requests per ${F.rateLimitWindowSeconds} seconds`,
    );
    expect(md()).toContain(`${F.errorRetentionDays} days`);
    expect(md()).toContain(F.lastUpdated);
  });

  it("keeps the owner's own voice and the data flows the page states", () => {
    expect(md()).toContain("I read them on a private dashboard");
    expect(md()).toContain("Developer mode");
    expect(md()).toMatch(/Wake word/);
    expect(md()).toMatch(/Vercel.s runtime logs/);
    for (const company of [
      "Vercel",
      "Amazon Web Services",
      "Google",
      "Upstash",
      "GitHub",
    ]) {
      expect(md(), company).toContain(company);
    }
    expect(md()).toContain(`mailto:${profile.email}`);
  });

  it("turns the page's headings into Markdown headings", () => {
    const headings = outsideCode(md())
      .split("\n")
      .filter((l) => l.startsWith("## "));
    expect(headings).toContain("## The short version");
    expect(headings).toContain("## Other companies involved");
    expect(headings.length).toBeGreaterThanOrEqual(10);
  });
});

describe("markdownForPage", () => {
  it("answers a page with the shared Markdown response shape", async () => {
    const res = await markdownForPage("privacy");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(res.headers.get("Link")).toBe(
      `<${SITE_URL}/privacy>; rel="canonical"`,
    );
    expect((await res.text()).startsWith("# ")).toBe(true);
  });

  it("answers a name that is not a page twin with a Markdown 404", async () => {
    for (const name of [
      "resume",
      "search",
      "stats",
      "nope",
      "__proto__",
      "About",
    ]) {
      const res = await markdownForPage(name);
      expect(res.status, name).toBe(404);
      expect(res.headers.get("Content-Type"), name).toBe(
        "text/markdown; charset=utf-8",
      );
      expect(await res.text(), name).toMatch(/^# 404/);
    }
  });
});

describe("notes ship dark", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function load(enabled: boolean) {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", enabled ? "true" : "false");
    return import("./page-markdown");
  }

  it("answers /notes with a Markdown 404 while the HTML page is a 404, so the two stay consistent", async () => {
    const { buildPageMarkdown: build, markdownForPage: respond } =
      await load(false);
    expect(await build("notes")).toBeNull();
    const res = await respond("notes");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("/notes");
  });

  it("lists the notes once the section is switched on", async () => {
    const { buildPageMarkdown: build } = await load(true);
    const { allNotes } = await import("@/lib/content");
    expect(allNotes.length).toBeGreaterThan(0);
    const md = (await build("notes")) as string;
    expect(md.startsWith("# ")).toBe(true);
    for (const n of allNotes)
      expect(md).toContain(`[${n.title}](${SITE_URL}${n.url})`);
  });
});
