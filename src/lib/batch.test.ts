import { describe, expect, it } from "vitest";
import {
  API_V1_BASE,
  BATCH_MAX_REQUESTS,
  BATCH_PATH,
} from "@/lib/api-policy";
import { buildV1Paths } from "@/lib/openapi-v1";
import {
  BATCH_MAX_ID_LENGTH,
  BATCH_MAX_PATH_LENGTH,
  BATCH_ROUTES,
  isJsonContentType,
  parseBatchBody,
  rejectBatch,
} from "./batch";

const bodyOf = (requests: unknown) => JSON.stringify({ requests });
const item = (id: string, path: string) => ({ id, path });
const reasonOf = (text: string) => {
  const parsed = parseBatchBody(text);
  if (parsed.ok) throw new Error("expected the batch to be rejected");
  return parsed.reason;
};

describe("BATCH_ROUTES, the registry of what a batch may run", () => {
  it("lists exactly the GET operations the OpenAPI document describes under /api/v1", () => {
    const documented = Object.entries(buildV1Paths())
      .filter(([, operations]) => operations.get)
      .map(([path]) => path);
    expect(BATCH_ROUTES.map((r) => r.template).sort()).toEqual(
      documented.sort(),
    );
  });

  it("only ever reaches the versioned API: no admin, cron, chat, voice, MCP or unversioned route, and not the batch endpoint", () => {
    for (const { template } of BATCH_ROUTES) {
      expect(
        template === API_V1_BASE || template.startsWith(`${API_V1_BASE}/`),
        template,
      ).toBe(true);
      expect(template, template).not.toBe(BATCH_PATH);
      expect(template, template).not.toMatch(
        /admin|cron|chat|tts|transcribe|visit|error|mcp|batch/,
      );
    }
  });

  it("names, per route, exactly the query parameters the OpenAPI document declares for it", () => {
    const documented = buildV1Paths();
    for (const route of BATCH_ROUTES) {
      const declared = (documented[route.template].get.parameters ?? [])
        .filter((parameter) => parameter.in === "query")
        .map((parameter) => parameter.name);
      expect([...(route.queryParams ?? [])].sort(), route.template).toEqual(declared.sort());
    }
  });

  it("loads a module with a GET handler for every entry", async () => {
    for (const route of BATCH_ROUTES) {
      const mod = await route.load();
      expect(typeof mod.GET, route.template).toBe("function");
    }
  });
});

describe("isJsonContentType", () => {
  it("accepts application/json with or without parameters, in any letter case", () => {
    for (const header of [
      "application/json",
      "application/json; charset=utf-8",
      "Application/JSON",
      " application/json ;charset=UTF-8",
    ]) {
      expect(isJsonContentType(header), header).toBe(true);
    }
  });

  it("rejects everything else, including other JSON-flavoured types", () => {
    for (const header of [
      null,
      "",
      "text/plain",
      "application/jsonx",
      "application/vnd.api+json",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
    ]) {
      expect(isJsonContentType(header), String(header)).toBe(false);
    }
  });
});

describe("parseBatchBody: what it accepts", () => {
  it("returns the id and path of each item in order, and treats a missing method as GET", () => {
    const parsed = parseBatchBody(
      bodyOf([
        item("a", "/api/v1/profile"),
        { id: "b", method: "GET", path: "/api/v1/projects/trelix" },
      ]),
    );
    expect(parsed).toEqual({
      ok: true,
      items: [
        { id: "a", path: "/api/v1/profile" },
        { id: "b", path: "/api/v1/projects/trelix" },
      ],
    });
  });

  it("accepts the API root, nested resources and query strings, including percent-escapes in the query", () => {
    for (const path of [
      "/api/v1",
      "/api/v1/profile",
      "/api/v1/github/stats",
      "/api/v1/projects/trelix",
      "/api/v1/search?q=multi%20agent",
      "/api/v1/search?q=a&x=%2e%2e%2f",
      "/api/v1/decisions?tag=mcp",
      "/api/v1/profile?",
    ]) {
      expect(parseBatchBody(bodyOf([item("a", path)])).ok, path).toBe(true);
    }
  });

  it("counts an id in characters, as the published maxLength does, not in UTF-16 units", () => {
    // 😀 is one character but two UTF-16 units, so 64 of them are 128 units long.
    for (const count of [1, 32, 33, 40, 64]) {
      const id = "😀".repeat(count);
      expect(parseBatchBody(bodyOf([item(id, "/api/v1/profile")])).ok, `${count} emoji`).toBe(true);
    }
    // Mixed astral and BMP characters, 64 in all.
    expect(parseBatchBody(bodyOf([item("𝒳".repeat(32) + "a".repeat(32), "/api/v1/profile")])).ok).toBe(true);
  });

  it("rejects an id of 65 characters whether they are one unit or two", () => {
    for (const id of ["x".repeat(65), "😀".repeat(65), "😀".repeat(33) + "é".repeat(32)]) {
      const reason = reasonOf(bodyOf([item(id, "/api/v1/profile")]));
      expect(reason).toContain("requests[0]");
      expect(reason).toContain("1 to 64 characters");
    }
  });

  it("accepts ids from 1 to 64 characters", () => {
    expect(BATCH_MAX_ID_LENGTH).toBe(64);
    for (const id of ["a", "x".repeat(64), "Projects/Trelix 1", "é"]) {
      expect(parseBatchBody(bodyOf([item(id, "/api/v1/profile")])).ok, id).toBe(
        true,
      );
    }
  });

  it(`accepts ${BATCH_MAX_REQUESTS} operations`, () => {
    const requests = Array.from({ length: BATCH_MAX_REQUESTS }, (_, i) =>
      item(`r${i}`, "/api/v1/profile"),
    );
    const parsed = parseBatchBody(bodyOf(requests));
    expect(parsed.ok && parsed.items).toHaveLength(BATCH_MAX_REQUESTS);
  });

  it("accepts a path of up to the length limit", () => {
    expect(BATCH_MAX_PATH_LENGTH).toBe(512);
    const prefix = "/api/v1/search?q=";
    const path = `${prefix}${"a".repeat(BATCH_MAX_PATH_LENGTH - prefix.length)}`;
    expect(path).toHaveLength(BATCH_MAX_PATH_LENGTH);
    expect(parseBatchBody(bodyOf([item("a", path)])).ok).toBe(true);
  });
});

describe("parseBatchBody: what it rejects, all or nothing", () => {
  it(`rejects more than ${BATCH_MAX_REQUESTS} operations and an empty list`, () => {
    const many = Array.from({ length: BATCH_MAX_REQUESTS + 1 }, (_, i) =>
      item(`r${i}`, "/api/v1/profile"),
    );
    expect(reasonOf(bodyOf(many))).toContain(`1 to ${BATCH_MAX_REQUESTS}`);
    expect(reasonOf(bodyOf([]))).toContain(`1 to ${BATCH_MAX_REQUESTS}`);
  });

  it("rejects a body that is not JSON, or not an object with a requests array", () => {
    for (const text of [
      "",
      "not json",
      "{",
      '{"requests":',
      "[]",
      "null",
      "42",
      '"requests"',
      "{}",
      '{"requests":{}}',
      '{"requests":"a"}',
      '{"requests":null}',
    ]) {
      expect(parseBatchBody(text).ok, JSON.stringify(text)).toBe(false);
    }
    expect(reasonOf("not json")).toContain("JSON");
  });

  it("rejects any other top-level field", () => {
    expect(
      reasonOf(
        JSON.stringify({
          requests: [item("a", "/api/v1/profile")],
          extra: 1,
        }),
      ),
    ).toContain("only");
  });

  it("rejects an item that is not an object", () => {
    for (const bad of [null, "x", 1, [], true]) {
      expect(reasonOf(bodyOf([item("ok", "/api/v1/profile"), bad]))).toContain(
        "requests[1]",
      );
    }
  });

  it("rejects a missing, empty, over-long or non-string id and names the index", () => {
    for (const id of [undefined, "", "x".repeat(65), 1, null, ["a"]]) {
      const reason = reasonOf(
        bodyOf([
          item("ok", "/api/v1/profile"),
          { id, path: "/api/v1/profile" },
        ]),
      );
      expect(reason, JSON.stringify(id)).toContain("requests[1]");
      expect(reason, JSON.stringify(id)).toContain("id");
    }
  });

  it("rejects a duplicate id and names both indexes", () => {
    const reason = reasonOf(
      bodyOf([
        item("a", "/api/v1/profile"),
        item("b", "/api/v1/work"),
        item("a", "/api/v1/projects"),
      ]),
    );
    expect(reason).toContain("requests[2]");
    expect(reason).toContain("requests[0]");
  });

  it("accepts only GET as a method", () => {
    for (const method of ["POST", "get", "DELETE", "HEAD", "", 1, null]) {
      const reason = reasonOf(
        bodyOf([{ id: "a", method, path: "/api/v1/profile" }]),
      );
      expect(reason, JSON.stringify(method)).toContain("requests[0]");
      expect(reason, JSON.stringify(method)).toContain("GET");
    }
  });

  it("rejects fields an item does not take (a body, headers) instead of ignoring them", () => {
    for (const extra of [
      { body: {} },
      { headers: { a: "b" } },
      { params: {} },
    ]) {
      expect(
        reasonOf(bodyOf([{ id: "a", path: "/api/v1/profile", ...extra }])),
      ).toContain("requests[0]");
    }
  });

  it("rejects a missing, non-string or over-long path", () => {
    const overLong = `/api/v1/search?q=${"a".repeat(BATCH_MAX_PATH_LENGTH)}`;
    for (const path of [
      undefined,
      null,
      1,
      ["/api/v1/profile"],
      "",
      overLong,
    ]) {
      expect(
        reasonOf(bodyOf([{ id: "a", path }])),
        JSON.stringify(path)?.slice(0, 20),
      ).toContain("requests[0]");
    }
  });

  it("rejects a path that leaves /api/v1: traversal, escapes, hosts, schemes, backslashes, control characters", () => {
    const hostile = [
      "api/v1/projects",
      "/",
      "/api/v2/projects",
      "/api/v1projects",
      "/api/v1/../admin/telemetry",
      "/api/v1/./projects",
      "/api/v1/projects/..",
      "/api/v1/..%2fadmin",
      "/api/v1/%2e%2e/admin",
      "/api/v1/%2E%2E%2Fadmin",
      "/api/v1/projects%2Ftrelix",
      "/api/v1/projects/tre%6Cix",
      "/api/v1//projects",
      "/api/v1/projects/",
      "///api/v1/projects",
      "//evil.example/api/v1/projects",
      "http://evil.example/api/v1/projects",
      "https://anvilry.vercel.app/api/v1/projects",
      "javascript:alert(1)//api/v1/x",
      "/api/v1\\projects",
      "/api/v1/projects\\..\\x",
      "/api/v1/pro jects",
      "/api/v1/projects\n",
      "/api/v1/projects\r\nHost: evil",
      "/api/v1/projects\t",
      "/api/v1/projects\0",
      "/api/v1/projects\u007f",
      "/api/v1/projects#fragment",
      "/api/v1/search?q=a b",
      "/api/v1/search?q=é",
      "/api/v1/search?q=a\\b",
      "/api/v1/search?q=a#b",
      "/api/v1/projects/trelïx",
      "/api/v1/projects/trelix.json",
      "/api/chat",
      "/api/admin/faq-cache/purge",
      "/api/cron/eval",
      "/api/mcp/mcp",
      "/api/resume.json",
      "/admin/telemetry",
    ];
    for (const path of hostile) {
      const reason = reasonOf(
        bodyOf([item("ok", "/api/v1/profile"), { id: "bad", path }]),
      );
      expect(reason, JSON.stringify(path)).toContain("requests[1]");
      expect(reason, JSON.stringify(path)).toContain("/api/v1");
    }
  });

  it("rejects a batch inside a batch, with a reason of its own", () => {
    for (const path of [BATCH_PATH, `${BATCH_PATH}?x=1`]) {
      const reason = reasonOf(bodyOf([item("a", path)]));
      expect(reason, path).toContain("requests[0]");
      expect(reason, path).toContain("another batch");
    }
  });

  it("reports the first offending item, so nothing after it matters", () => {
    expect(
      reasonOf(bodyOf([item("a", "/nope"), item("b", "/also-nope")])),
    ).toContain("requests[0]");
  });

  it("never repeats text the client sent", () => {
    const marker = "attacker-controlled-marker";
    const bodies = [
      bodyOf([{ id: "a", path: `/api/v1/${marker}/../x` }]),
      bodyOf([{ id: "a", method: marker, path: "/api/v1/profile" }]),
      bodyOf([
        { id: marker, path: "/api/v1/profile" },
        { id: marker, path: "/api/v1/work" },
      ]),
      bodyOf([{ id: "a", path: "/api/v1/profile", [marker]: 1 }]),
      JSON.stringify({ requests: [], [marker]: 1 }),
    ];
    for (const text of bodies) {
      expect(reasonOf(text), text).not.toContain(marker);
    }
  });
});

describe("rejectBatch", () => {
  it("is a 400 invalid_request that says nothing ran and carries the reason as the hint", async () => {
    const res = rejectBatch("requests[3]: the path is wrong.");
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const body = await res.json();
    expect(body.code).toBe("invalid_request");
    expect(body.error.toLowerCase()).toContain("nothing ran");
    expect(body.hint).toContain("requests[3]: the path is wrong.");
    expect(body.hint).toContain("whole batch");
  });
});
