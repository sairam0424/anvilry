import { listResponse } from "@/lib/content-api";
import { listProjectsData } from "@/lib/mcp-tools";

/** GET /api/v1/projects: every project, the data of the list_projects MCP tool. Static. */
export function GET() {
  return listResponse(listProjectsData());
}
