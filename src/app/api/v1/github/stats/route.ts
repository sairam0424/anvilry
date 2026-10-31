import { GET as getLegacyGithubStats } from "@/app/api/github/stats/route";
import { methodNotAllowed, optionsFor, withJsonErrors } from "@/lib/api-error";

/**
 * GET /api/v1/github/stats: the same aggregate GitHub numbers as the unversioned /api/github/stats,
 * answered by that route's own handler so the two cannot differ. Dynamic like the original: the
 * live GitHub fetch must happen at request time (cached for an hour at the fetch level), never be
 * frozen into the build, so it carries the JSON 405 stubs.
 */
export const GET = withJsonErrors(getLegacyGithubStats);

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["GET", "HEAD"]);
