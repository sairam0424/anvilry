import { listResponse } from "@/lib/content-api";
import { listWorkData } from "@/lib/mcp-tools";

/** GET /api/v1/work: every production case study, the data of the list_work MCP tool. Static. */
export function GET() {
  return listResponse(listWorkData());
}
