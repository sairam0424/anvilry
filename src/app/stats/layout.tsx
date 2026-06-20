import type { Metadata } from "next";
import { profile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Stats",
  description: `Open-source impact and engineering stats for ${profile.name}.`,
  alternates: { canonical: "/stats" },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
