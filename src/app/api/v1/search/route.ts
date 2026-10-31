import { apiError, methodNotAllowed, optionsFor, withJsonErrors } from "@/lib/api-error";
import { jsonResponse, MAX_TEXT_PARAM_LENGTH, parseTextParam } from "@/lib/content-api";
import { searchExperienceData } from "@/lib/mcp-tools";

/**
 * GET /api/v1/search?q=: keyword search across work, projects and skills, the data of the
 * search_experience MCP tool. Dynamic: it reads the query string, so it carries the JSON 405 stubs.
 */
export const GET = withJsonErrors((req: Request) => {
  const query = parseTextParam(new URL(req.url).searchParams.get("q"));
  if (!query) {
    return apiError(
      400,
      "invalid_request",
      `The q query parameter is required and must be 1 to ${MAX_TEXT_PARAM_LENGTH} characters.`,
    );
  }
  return jsonResponse(searchExperienceData(query));
});

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["GET", "HEAD"]);
