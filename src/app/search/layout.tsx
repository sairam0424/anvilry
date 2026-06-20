import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description: "Search across projects, work, articles, and notes.",
  alternates: { canonical: "/search" },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
