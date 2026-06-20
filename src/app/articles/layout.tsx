import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ARTICLES_ENABLED } from "@/lib/writing-flags";

export const metadata: Metadata = {
  title: "Articles",
  description: "Articles and long-form writing published on Medium, Substack, and LinkedIn.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  if (!ARTICLES_ENABLED) notFound();
  return children;
}
