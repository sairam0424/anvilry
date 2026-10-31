import { jsonResponse } from "@/lib/content-api";
import { buildResumeJson } from "@/lib/resume-json";

/** GET /api/v1/resume: the same JSON Resume document as /api/resume.json. Static. */
export function GET() {
  return jsonResponse(buildResumeJson());
}
