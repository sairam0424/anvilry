import { apiError } from "@/lib/api-error";

/**
 * Catch-all for `/api/*`. Every real route is more specific and wins; whatever falls
 * through here is a path that does not exist, and an agent probing the API should get
 * a JSON error it can parse (with a pointer to the route list), not an HTML 404 page.
 *
 * The response never echoes the requested path: JSON is not rendered, but the habit of
 * reflecting request input into an error body is exactly how prompt-injection text
 * reaches a model, so the body stays constant.
 */
function notFound(): Response {
  return apiError(404, "not_found", "No API route exists at this path.", {
    hint: "List the real routes in /openapi.json; the developer guide is at /developers.",
  });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
