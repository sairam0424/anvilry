import { buildResumeJson } from "@/lib/resume-json";

// Static JSON — force-static so the export is prerendered (Next 16 GET handlers are
// dynamic by default). Build-time fixed; reuses the site's single content source.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildResumeJson());
}
