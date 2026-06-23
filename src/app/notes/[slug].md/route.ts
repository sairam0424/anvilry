import { allNotes } from "@/lib/content";
import { readFileSync } from "fs";
import { join } from "path";
import type { NextRequest } from "next/server";

// Dynamic route — slug extracted from URL since Next.js does not populate params
// for directory segments of the form `[param].ext` (ParamMap resolves to {}).
export const dynamic = "force-dynamic";

function stripFrontmatter(raw: string): string {
  // Remove YAML frontmatter delimited by --- at the start of the file
  return raw.replace(/^---[\s\S]*?---\s*\n?/, "").trimStart();
}

function readRawContent(slug: string): string | null {
  const base = join(process.cwd(), "content", "notes");
  for (const ext of ["mdx", "md"]) {
    try {
      return readFileSync(join(base, `${slug}.${ext}`), "utf-8");
    } catch {
      // try next extension
    }
  }
  return null;
}

export function GET(req: NextRequest) {
  // Extract slug from URL: /notes/how-dns-works.md -> "how-dns-works"
  const pathname = new URL(req.url).pathname;
  const slug = pathname.split("/").pop()?.replace(/\.md$/, "") ?? "";

  const item = allNotes.find((n) => n.slug === slug);
  if (!item) return new Response("Not found", { status: 404 });

  const raw = readRawContent(slug);
  if (!raw) return new Response("Not found", { status: 404 });

  return new Response(stripFrontmatter(raw), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
