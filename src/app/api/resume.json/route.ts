import { buildResumeJson } from "@/lib/resume-json";

export function GET() {
  return Response.json(buildResumeJson());
}
