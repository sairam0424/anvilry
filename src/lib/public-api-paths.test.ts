import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { API_V1_BASE, BATCH_PATH } from "./api-policy";
import { allowedMethods, isPublicApiPath } from "./public-api-paths";
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
      "/.well-known/api-catalog",
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

describe("allowedMethods", () => {
  const READ = ["GET", "HEAD", "OPTIONS"];

  it("is read-only for every public path by default", () => {
    for (const path of [
      API_V1_BASE,
      `${API_V1_BASE}/projects/trelix`,
      "/api/resume.json",
      "/llms.txt",
      "/openapi.json",
      "/projects/trelix.md",
    ]) {
      expect(allowedMethods(path), path).toEqual(READ);
    }
  });

  it("lets the batch endpoint take POST and nothing else but OPTIONS", () => {
    expect(allowedMethods(BATCH_PATH)).toEqual(["POST", "OPTIONS"]);
  });

  it("ignores a trailing slash, as isPublicApiPath does", () => {
    expect(allowedMethods(`${BATCH_PATH}/`)).toEqual(["POST", "OPTIONS"]);
    expect(allowedMethods(`${API_V1_BASE}/work/`)).toEqual(READ);
  });

  it("does not extend the exception to a path below or beside the batch endpoint", () => {
    for (const path of [`${BATCH_PATH}/extra`, `${BATCH_PATH}x`, `${API_V1_BASE}/batches`]) {
      expect(allowedMethods(path), path).toEqual(READ);
    }
  });

  it("keeps the batch endpoint a public API path, so it gets the headers and the budget", () => {
    expect(isPublicApiPath(BATCH_PATH)).toBe(true);
  });
});

describe("proxy matcher", () => {
  const wakes = (path: string) =>
    unstable_doesMiddlewareMatch({ config: proxyConfig, url: `https://anvilry.vercel.app${path}` });

  it("wakes the proxy for every path it must stamp with headers", () => {
    for (const path of [
      `${API_V1_BASE}`,
      `${API_V1_BASE}/work/pensieve`,
      BATCH_PATH,
      "/api/resume.json",
      "/api/github/stats",
      "/api/mcp/mcp",
      "/.well-known/api-catalog",
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
