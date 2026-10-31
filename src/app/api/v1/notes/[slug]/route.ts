import { methodNotAllowed, optionsFor, withJsonErrors } from "@/lib/api-error";
import { getNoteData, respondWithItem, type SlugRouteContext } from "@/lib/content-api";

/** GET /api/v1/notes/{slug}: one note by slug. Dynamic: it reads the slug, so it carries the JSON 405 stubs. */
export const GET = withJsonErrors((_req: Request, { params }: SlugRouteContext) =>
  respondWithItem("notes", params, getNoteData),
);

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["GET", "HEAD"]);
