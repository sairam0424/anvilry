import { buildOpenApiDocument } from "@/lib/openapi";

/**
 * GET /openapi.json: the OpenAPI 3.1 description of the public API. Built from
 * src/lib/openapi.ts, which /developers also renders from. Served statically.
 */
export function GET() {
  return new Response(JSON.stringify(buildOpenApiDocument(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
