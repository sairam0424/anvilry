import { methodNotAllowed } from "@/lib/api-error";
import { buildResumeJson } from "@/lib/resume-json";

export function GET() {
  return Response.json(buildResumeJson());
}

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
