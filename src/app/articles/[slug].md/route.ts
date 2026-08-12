import { allArticles } from "@/lib/content";
import { readFileSync } from "fs";
import { join } from "path";
import type { NextRequest } from "next/server";

// Slug is extracted from the URL because Next.js does not populate params for directory
// segments of the form `[param].ext` (ParamMap resolves to {}). Reading the request is what
// makes this handler dynamic, so the explicit `export const dynamic = "force-dynamic"` was
// redundant — it is also rejected under nextConfig.cacheComponents, so it was removed.

function stripFrontmatter(raw: string): string {
  // Remove YAML frontmatter delimited by --- at the start of the file
  return raw.replace(/^---[\s\S]*?---\s*\n?/, "").trimStart();
}

function readRawContent(slug: string): string | null {
  const base = join(process.cwd(), "content", "articles");
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
  // Extract slug from URL: /articles/how-dns-works.md -> "how-dns-works"
  const pathname = new URL(req.url).pathname;
  const slug = pathname.split("/").pop()?.replace(/\.md$/, "") ?? "";

  const item = allArticles.find((a) => a.slug === slug);
  if (!item) return new Response("Not found", { status: 404 });

  const raw = readRawContent(slug);
  if (!raw) return new Response("Not found", { status: 404 });

  return new Response(stripFrontmatter(raw), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
