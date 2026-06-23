import { allArticles } from "@/lib/content";
import { readFileSync } from "fs";
import { join } from "path";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function stripFrontmatter(raw: string): string {
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const item = allArticles.find((a) => a.slug === slug);
  if (!item) return new Response("Not found", { status: 404 });

  const raw = readRawContent(slug);
  if (!raw) return new Response("Not found", { status: 404 });

  return new Response(stripFrontmatter(raw), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
