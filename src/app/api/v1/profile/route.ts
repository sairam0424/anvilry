import { jsonResponse } from "@/lib/content-api";
import { getProfileData } from "@/lib/mcp-tools";

/** GET /api/v1/profile: identity, links, skills and achievements, the data of the get_profile MCP tool. Static. */
export function GET() {
  return jsonResponse(getProfileData());
}
