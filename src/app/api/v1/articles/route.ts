import { listArticlesData, listResponse } from "@/lib/content-api";

/** GET /api/v1/articles: every published article. Empty when none is published. Static. */
export function GET() {
  return listResponse(listArticlesData());
}
