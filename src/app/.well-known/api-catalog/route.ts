import { API_CATALOG_CONTENT_TYPE, buildApiCatalog } from "@/lib/api-catalog";

export function GET() {
  return new Response(JSON.stringify(buildApiCatalog()), {
    headers: { "Content-Type": API_CATALOG_CONTENT_TYPE },
  });
}
