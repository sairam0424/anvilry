import type { Metadata } from "next";
import { profile } from "@/lib/profile";

const description = `Download ${profile.name}'s résumé — role-targeted variants for Backend, GenAI, and Full-Stack.`;

export const metadata: Metadata = {
  title: "Résumé",
  description,
  alternates: { canonical: "/resume" },
  openGraph: { type: "website", url: "/resume", title: `Résumé — ${profile.name}`, description },
};

export default function ResumeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
