import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { API_ERROR_CODES } from "@/lib/api-error";
import { buildOpenApiDocument, listOperations } from "@/lib/openapi";
import { PRIVACY_FACTS } from "@/lib/privacy-facts";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";
import ContactPage, { metadata as contactMeta } from "./contact/page";
import DevelopersPage, { metadata as developersMeta } from "./developers/page";
import PrivacyPage, { metadata as privacyMeta } from "./privacy/page";

const MIN_TRUST_PAGE_CHARS = 500;

function render(node: React.ReactElement): { html: string; text: string } {
  // The real layout mounts TooltipProvider (providers.tsx); CopyButton needs it.
  const html = renderToStaticMarkup(<TooltipProvider>{node}</TooltipProvider>);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
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
