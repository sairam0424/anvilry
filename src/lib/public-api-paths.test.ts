import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { API_V1_BASE } from "./api-policy";
import { isPublicApiPath } from "./public-api-paths";
import { buildOpenApiDocument, listOperations } from "./openapi";
import { config as proxyConfig } from "../proxy";

describe("isPublicApiPath", () => {
  it("accepts the versioned API, its aliases, the MCP endpoint and the discovery files", () => {
    for (const path of [
      API_V1_BASE,
      `${API_V1_BASE}/projects`,
      `${API_V1_BASE}/projects/trelix`,
      "/api/resume.json",
      "/api/github/stats",
      "/api/mcp/mcp",
      "/llms.txt",
      "/llms-full.txt",
      "/openapi.json",
      "/feed.xml",
      "/sitemap.xml",
      "/robots.txt",
      "/index.md",
      "/about.md",
      "/projects/trelix.md",
      "/work/pensieve.md",
    ]) {
      expect(isPublicApiPath(path), path).toBe(true);
    }
  });

  it("ignores a trailing slash, as the rest of the routing does", () => {
    expect(isPublicApiPath("/api/v1/projects/")).toBe(true);
  });

  it("leaves pages, the cost-bearing routes and operator routes alone", () => {
    for (const path of [
      "/",
      "/about",
      "/developers",
      "/projects/trelix",
      "/api/chat",
      "/api/tts",
      "/api/transcribe",
      "/api/visit",
      "/api/error",
      "/api/admin/faq-cache/purge",
      "/api/cron/eval",
      "/api/md/home",
      "/admin/telemetry",
      "/_next/static/chunk.js",
      "/api/v10/projects",
    ]) {
      expect(isPublicApiPath(path), path).toBe(false);
    }
  });
});

describe("proxy matcher", () => {
  const wakes = (path: string) =>
    unstable_doesMiddlewareMatch({ config: proxyConfig, url: `https://anvilry.vercel.app${path}` });

  it("wakes the proxy for every path it must stamp with headers", () => {
    for (const path of [
      `${API_V1_BASE}`,
      `${API_V1_BASE}/work/pensieve`,
      "/api/resume.json",
      "/api/github/stats",
      "/api/mcp/mcp",
      "/llms.txt",
      "/llms-full.txt",
      "/openapi.json",
      "/feed.xml",
      "/sitemap.xml",
      "/robots.txt",
      "/index.md",
      "/about.md",
      "/projects/trelix.md",
    ]) {
      expect(wakes(path), path).toBe(true);
    }
  });

  it("covers every documented operation that isPublicApiPath claims", () => {
    const doc = buildOpenApiDocument();
    for (const { path } of listOperations(doc)) {
      const concrete = path.replace("{slug}", "example");
      if (!isPublicApiPath(concrete)) continue;
      expect(wakes(concrete), `proxy does not wake for ${concrete}`).toBe(true);
    }
  });

  it("does not wake the proxy for ordinary page requests", () => {
    for (const path of ["/", "/about", "/projects/trelix", "/developers", "/_next/static/a.js"]) {
      expect(wakes(path), path).toBe(false);
    }
  });
});
