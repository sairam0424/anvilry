import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Articles",
  description: "Articles and long-form writing published on Medium, Substack, and LinkedIn.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
