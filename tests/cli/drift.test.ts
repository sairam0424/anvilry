import { describe, expect, it } from "vitest";
import {
  API_V1_BASE,
  API_VERSION,
  API_VERSION_HEADER,
  BATCH_MAX_REQUESTS,
  BATCH_PATH,
} from "@/lib/api-policy";
import { SLUG_PATTERN as SITE_SLUG_PATTERN } from "@/lib/content-api";
import { buildOpenApiDocument } from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";
import { COMMANDS } from "../../cli/lib/commands.mjs";
import {
  API_VERSION as CLI_API_VERSION,
  API_VERSION_HEADER as CLI_API_VERSION_HEADER,
  BATCH_MAX_OPERATIONS,
  DEFAULT_BASE_URL,
  DOCS_URL,
  SLUG_PATTERN as CLI_SLUG_PATTERN,
} from "../../cli/lib/constants.mjs";

/**
 * The CLI is a standalone package and cannot import from src/, so a few values live in both
 * places. These tests are the only thing that ties them together: when the site changes one, the
 * CLI must change with it, and this file says which.
 */

describe("the CLI agrees with the site", () => {
  it("speaks the API version the site serves, in the header the site reads", () => {
    expect(CLI_API_VERSION).toBe(API_VERSION);
    expect(CLI_API_VERSION_HEADER).toBe(API_VERSION_HEADER);
  });

  it("validates slugs with the site's own rule", () => {
    expect(CLI_SLUG_PATTERN).toBe(SITE_SLUG_PATTERN);
  });

  it("limits a batch to what the API accepts", () => {
    expect(BATCH_MAX_OPERATIONS).toBe(BATCH_MAX_REQUESTS);
  });

  it("talks to the canonical origin and links the site's developer page", () => {
    expect(DEFAULT_BASE_URL).toBe(SITE_URL);
    expect(DOCS_URL).toBe(`${SITE_URL}/developers`);
  });

  it("sends batch to the batch route of the policy", () => {
    const batch = COMMANDS.find((command) => command.name === "batch");
    expect(batch?.path).toBe(BATCH_PATH);
    expect(BATCH_PATH.startsWith(API_V1_BASE)).toBe(true);
  });
});

describe("every command requests a documented operation", () => {
  const { paths } = buildOpenApiDocument();
  const documented = (path: string, method: "get" | "post") =>
    method in ((paths as Record<string, object>)[path] ?? {});

  // batch is checked against the policy constants above; its OpenAPI entry is owned by the route's author.
  const requesting = COMMANDS.filter(
    (command) => command.method !== null && command.name !== "batch",
  );

  it.each(requesting.map((command) => [command.name, command.path] as const))(
    "%s: %s is a GET operation in /openapi.json",
    (_name, template) => {
      const withoutVariables = (template ?? "").replace(/\{[/?][a-z]+\}/g, "");
      expect(documented(withoutVariables, "get"), withoutVariables).toBe(true);
      if (template?.includes("{/slug}")) {
        expect(documented(`${withoutVariables}/{slug}`, "get")).toBe(true);
      }
    },
  );
});
