import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

describe("unknown API paths", () => {
  for (const [method, handler] of Object.entries({
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
  })) {
    it(`${method} answers a JSON 404 an agent can act on`, async () => {
      const res = handler();
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toMatch(/^application\/json/);
      const json = await res.json();
      expect(json.code).toBe("not_found");
      expect(json.error).toMatch(/no api route/i);
      expect(json.hint).toContain("/openapi.json");
    });
  }
});
