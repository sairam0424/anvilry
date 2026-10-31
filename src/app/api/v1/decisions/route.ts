import { apiError, methodNotAllowed, optionsFor, withJsonErrors } from "@/lib/api-error";
import { listResponse, MAX_TEXT_PARAM_LENGTH, parseTextParam } from "@/lib/content-api";
import { listDecisionsData } from "@/lib/mcp-tools";

/**
 * GET /api/v1/decisions?tag=: the architecture-decision ledger, the data of the list_decisions MCP
 * tool, optionally filtered by one tag. Dynamic: it reads the query string, so it carries the JSON
 * 405 stubs.
 */
export const GET = withJsonErrors((req: Request) => {
  const rawTag = new URL(req.url).searchParams.get("tag");
  if (rawTag === null) return listResponse(listDecisionsData());
  const tag = parseTextParam(rawTag);
  if (!tag) {
    return apiError(
      400,
      "invalid_request",
      `The tag query parameter, when sent, must be 1 to ${MAX_TEXT_PARAM_LENGTH} characters.`,
    );
  }
  return listResponse(listDecisionsData(tag));
});

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["GET", "HEAD"]);
