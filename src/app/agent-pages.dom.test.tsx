import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { API_CATALOG_PATH } from "@/lib/api-catalog";
import { API_ERROR_CODES } from "@/lib/api-error";
import {
  API_V1_BASE,
  BATCH_PATH,
  DEPRECATION_NOTICE_DAYS,
  RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICY_TEXT,
  VERSIONING_POLICY,
} from "@/lib/api-policy";
import { CLI, CLI_COMMANDS, cliHeading, cliSourceNote, cliStatus } from "@/lib/developer-tools";
import { batchSemantics, batchSentence, buildBatchRecipe, RESPONSE_HEADERS } from "@/lib/developers-content";
import { markdownResponse } from "@/lib/markdown-response";
import { buildOpenApiDocument, listOperations } from "@/lib/openapi";
import { PRIVACY_FACTS } from "@/lib/privacy-facts";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";
import ContactPage, { metadata as contactMeta } from "./contact/page";
import DevelopersPage, { metadata as developersMeta } from "./developers/page";
import McpPage, { metadata as mcpMeta } from "./mcp/page";
import PrivacyPage, { metadata as privacyMeta } from "./privacy/page";

const MIN_TRUST_PAGE_CHARS = 500;

function render(node: React.ReactElement): { html: string; text: string } {
  // The real layout mounts TooltipProvider (providers.tsx); CopyButton needs it.
  const html = renderToStaticMarkup(<TooltipProvider>{node}</TooltipProvider>);
  // Parse the markup instead of stripping it with regular expressions: a parser decodes entities
  // once and drops script and style bodies, which hand-written replaces get subtly wrong.
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  const pieces: string[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) pieces.push(n.textContent ?? "");
  const text = pieces.join(" ").replace(/\s+/g, " ").trim();
  return { html, text };
}

/** Site paths these pages link to; each must be a real page or file. */
const KNOWN_TARGETS = new Set([
  "/contact",
  "/privacy",
  "/developers",
  "/mcp",
  "/llms.txt",
  "/llms-full.txt",
  "/openapi.json",
  API_CATALOG_PATH,
  "/api/resume.json",
  "/feed.xml",
  "/sitemap.xml",
  "/robots.txt",
]);

function internalLinks(html: string): string[] {
  return [...html.matchAll(/href="(\/[^"#]*)/g)].map((m) => m[1]);
}

describe("/developers", () => {
  const { html, text } = render(<DevelopersPage />);

  it("has one h1 that names the product", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(text).toContain("Build on Anvilry");
    expect(String(developersMeta.title)).toContain("Anvilry");
  });

  it("says Anvilry and API documentation in its title and in the h1, so a search by name finds it", () => {
    expect(String(developersMeta.title)).toBe("Anvilry API documentation");
    const h1 = new DOMParser().parseFromString(html, "text/html").querySelector("h1")?.textContent ?? "";
    expect(h1).toContain("Anvilry");
    expect(h1).toContain("API documentation");
  });

  it("has a stable anchor for authentication, versioning, rate limits, the SDK and the command line", () => {
    for (const id of ["authentication", "versioning", "rate-limits", "sdk", "cli", "endpoints", "errors", "mcp"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    for (const title of ["Authentication", "Versioning", "Rate limits", "Anvilry SDK and client libraries", cliHeading(CLI)]) {
      expect(text, title).toContain(title);
    }
  });

  it("states that there are no API keys and nothing to authenticate with", () => {
    expect(text).toMatch(/Anvilry has no authentication/);
    expect(text).toMatch(/no API\s+keys, tokens, OAuth flows or accounts/);
  });

  it("prints the published versioning and rate-limit policy, sentence for sentence", () => {
    for (const sentence of [...VERSIONING_POLICY, ...RATE_LIMIT_POLICY_TEXT]) expect(text).toContain(sentence);
    expect(text).toContain(`${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds`);
    expect(text).toContain(`at least ${DEPRECATION_NOTICE_DAYS} days`);
  });

  it("documents every response header of the contract, each with when it is sent", () => {
    expect(RESPONSE_HEADERS).toHaveLength(9);
    for (const { name, sent, meaning } of RESPONSE_HEADERS) {
      expect(text, name).toContain(name);
      expect(text, `${name}: ${sent}`).toContain(sent);
      expect(text, `${name}: meaning`).toContain(meaning);
    }
  });

  it("says plainly that there is no official SDK, and invents no package name", () => {
    expect(text).toMatch(/There is no official SDK for Anvilry/);
    expect(text).toContain("/openapi.json");
    expect(text).not.toMatch(/pip install |go get |brew install /i);
  });

  // The CLI wording follows CLI.published (src/lib/developer-tools.ts); developers-states.dom.test.tsx
  // forces both states, this checks that the page agrees with the real flag whichever way it is set.
  it("describes the CLI the way CLI.published says, and advertises npx only once it is published", () => {
    expect(text).toContain(cliHeading(CLI));
    expect(text).toContain(cliStatus(CLI));
    const note = cliSourceNote(CLI);
    if (note !== null) expect(text).toContain(note);
    if (CLI.published) {
      expect(text).toContain(CLI.runCommand);
      expect(text).toContain(CLI.installCommand);
      for (const command of CLI_COMMANDS) expect(text, command.name).toContain(command.usage);
    } else {
      expect(text).toMatch(/There is no published CLI package for Anvilry/);
      expect(text).not.toMatch(/npm (install|i) |npx @?anvilry/i);
      expect(text).not.toContain(CLI.packageUrl.replace("https://", ""));
    }
  });

  it("documents the batch endpoint: its sentence, its curl call from the document's example and its table row", () => {
    expect(text).toContain(batchSentence());
    expect(text).toContain(batchSemantics());
    expect(text).toContain(buildBatchRecipe(buildOpenApiDocument()).replace(/\s+/g, " "));
    expect(text).toContain(`-X POST ${SITE_URL}${BATCH_PATH}`);
    expect(text).toContain("runBatch");
  });

  it("shows curl recipes against the versioned API and for the response headers", () => {
    expect(text).toContain(`${SITE_URL}${API_V1_BASE}`);
    expect(text).toContain(`curl -sS ${SITE_URL}${API_V1_BASE}`);
    expect(text).toContain(`curl -sS -D - -o /dev/null ${SITE_URL}/openapi.json`);
  });

  // Next replaces the Vary header of an HTML response, so the page claims only what is provable:
  // the Markdown responses carry it (markdownResponse, pinned in page-markdown.test.ts) and each page
  // with a twin advertises it through a Link header (the rule in next.config.ts, pinned in next-config.test.ts).
  it("claims about Vary only that Markdown responses carry it, and about Link that the HTML page advertises its twin", () => {
    expect(text).toContain("Markdown responses carry Vary: Accept");
    expect(text).toMatch(/The HTML page of each also points to its Markdown version with a Link header \(\s*rel="alternate"\s*\)/);
    expect(text).not.toMatch(/caches keep the two apart/i);
    expect(text).not.toMatch(/Responses carry Vary/);
    expect(markdownResponse("x").headers.get("Vary")).toBe("Accept");
  });

  it("points at the API catalog in its machine-readable files, in one sentence", () => {
    expect(html).toContain(`href="${API_CATALOG_PATH}"`);
    expect(text).toMatch(/API catalog \(RFC 9727\)/);
  });

  it("no longer says the documented routes have no quota, now that they have one", () => {
    expect(text).not.toMatch(/apply no quota of their own/i);
  });

  it("lists the pages that have a Markdown version and the ones that do not", () => {
    for (const page of ["/about", "/articles", "/contact", "/decisions", "/developers", "/mcp", "/notes", "/privacy", "/projects", "/work"]) {
      expect(text, page).toContain(page);
    }
    expect(text).toMatch(/\/resume.*\/search.*\/stats/);
  });

  it("documents every operation in the OpenAPI document, with its path and operationId", () => {
    for (const { path, operation } of listOperations(buildOpenApiDocument())) {
      expect(text, operation.operationId).toContain(operation.operationId);
      expect(text, path).toContain(path);
    }
  });

  it("documents every error code and anchors the errors section", () => {
    expect(html).toContain('id="errors"');
    for (const { code } of API_ERROR_CODES) expect(text).toContain(code);
  });

  it("shows runnable examples against the real host", () => {
    expect(text).toContain(`curl -sS ${SITE_URL}/openapi.json`);
    expect(text).toContain(`curl -sS -H 'Accept: text/markdown' ${SITE_URL}/`);
    expect(text).toContain("tools/list");
  });

  it("says plainly that no key is needed and what is out of scope", () => {
    expect(text).toMatch(/no API keys/i);
    expect(text).toMatch(/read-only/i);
    expect(text).toMatch(/not part of this API/i);
  });

  it("links only to pages and files that exist", () => {
    for (const href of internalLinks(html)) expect(KNOWN_TARGETS.has(href), href).toBe(true);
  });

  it("does not claim more than the code does", () => {
    expect(text).not.toMatch(/Markdown versions of every page/i);
    expect(text).not.toMatch(/every failure in one shape/i);
    expect(text).not.toMatch(/every public page/i);
    expect(text).toMatch(/JSON-RPC/);
  });

  it("is long enough to count as documentation", () => {
    expect(text.length).toBeGreaterThan(MIN_TRUST_PAGE_CHARS);
  });
});

describe("/contact", () => {
  const { html, text } = render(<ContactPage />);

  it("publishes the same email, call link and profiles the rest of the site uses", () => {
    expect(html).toContain(`mailto:${profile.email}`);
    expect(html).toContain(profile.calendlyUrl);
    expect(html).toContain(profile.links.linkedin);
    expect(html).toContain(profile.links.github);
  });

  it("has one h1, a canonical path and enough text to be a trust page", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(contactMeta.alternates?.canonical).toBe("/contact");
    expect(text.length).toBeGreaterThan(MIN_TRUST_PAGE_CHARS);
  });

  it("does not publish a phone number or street address", () => {
    expect(text).not.toMatch(/\+\d{2}[\s-]?\d{5,}/);
    expect(text).not.toMatch(/\bstreet\b|\broad\b/i);
  });

  it("links only to pages that exist", () => {
    for (const href of internalLinks(html)) expect(KNOWN_TARGETS.has(href), href).toBe(true);
  });
});

describe("/privacy", () => {
  const { html, text } = render(<PrivacyPage />);

  it("has one h1, a canonical path and a substantial body", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(privacyMeta.alternates?.canonical).toBe("/privacy");
    expect(text.length).toBeGreaterThan(MIN_TRUST_PAGE_CHARS * 4);
  });

  it("prints every number it is pinned to in privacy-facts", () => {
    expect(text).toContain(`last ${PRIVACY_FACTS.chatMessagesKept} messages`);
    expect(text).toContain(`${PRIVACY_FACTS.chatCharsPerMessage} characters`);
    expect(text).toContain(`${PRIVACY_FACTS.faqCacheHours} hours`);
    expect(text).toContain(
      `${PRIVACY_FACTS.rateLimitRequests} requests per ${PRIVACY_FACTS.rateLimitWindowSeconds} seconds`,
    );
    expect(text).toContain(`${PRIVACY_FACTS.errorRetentionDays} days`);
    expect(text).toContain(PRIVACY_FACTS.lastUpdated);
  });

  it("states the data flows a reviewer found missing or wrong", () => {
    expect(text).toContain("Developer mode");
    expect(text).not.toMatch(/opening the command palette/i);
    expect(text).toMatch(/Wake word/);
    expect(text).toMatch(/Server logs/);
    expect(text).toMatch(/Vercel.s runtime logs/);
    expect(text).toMatch(/attachments/i);
    expect(text).toMatch(/embedding/i);
    expect(text).not.toMatch(/never leave your device/i);
  });

  it("speaks in the owner's own voice throughout and names the real character cut", () => {
    expect(text).not.toMatch(/The owner reads/);
    expect(text).toMatch(/I read them on a private dashboard/);
    expect(text).toContain(`${PRIVACY_FACTS.chatCharsPerMessage}-character cut does not apply to the image`);
  });

  it("describes the public API limit, and says its counter stays in server memory", () => {
    expect(text).toContain(
      `${PRIVACY_FACTS.publicApiRequests} requests per ${PRIVACY_FACTS.publicApiWindowSeconds} seconds per IP address`,
    );
    expect(text).toMatch(/kept only in the memory of the server instance/);
    expect(text).toMatch(/not written to Upstash or to any log/);
  });

  it("names every outside company that receives data", () => {
    for (const company of ["Vercel", "Amazon Web Services", "Google", "Upstash", "GitHub"]) {
      expect(text, company).toContain(company);
    }
  });

  it("tells visitors how to reach the owner", () => {
    expect(html).toContain(`mailto:${profile.email}`);
  });

  it("links only to pages that exist", () => {
    for (const href of internalLinks(html)) expect(KNOWN_TARGETS.has(href), href).toBe(true);
  });
});

describe("/mcp", () => {
  const { html, text } = render(<McpPage />);

  it("names the product in its title, description and its one h1", () => {
    expect(String(mcpMeta.title)).toBe("Anvilry MCP server");
    expect(String(mcpMeta.description)).toContain("Anvilry MCP server");
    expect(html.match(/<h1/g)).toHaveLength(1);
    const h1 = new DOMParser().parseFromString(html, "text/html").querySelector("h1")?.textContent ?? "";
    expect(h1).toContain("Anvilry MCP server");
  });

  it("still shows the endpoint, the client configuration and the tool table", () => {
    expect(text).toContain("https://anvilry.vercel.app/api/mcp/mcp");
    expect(text).toContain("mcpServers");
    expect(text).toContain("list_decisions");
  });
});
