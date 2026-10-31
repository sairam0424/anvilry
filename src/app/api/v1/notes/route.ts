import { listNotesData, listResponse } from "@/lib/content-api";

/** GET /api/v1/notes: every published note. Always empty while NEXT_PUBLIC_NOTES_ENABLED is off (the default). Static. */
export function GET() {
  return listResponse(listNotesData());
}
