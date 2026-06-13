import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { CommandPalette } from "@/components/command-palette";
import { AskPortfolio } from "@/components/ask-portfolio";
import { ViewHint } from "@/components/view-hint";
import { EasterEggs } from "@/components/game/easter-eggs";
import { PersonJsonLd } from "@/components/json-ld";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { profile } from "@/lib/profile";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

const siteUrl = "https://anvilry.vercel.app";

// Dark browser chrome (address bar / status bar) to match the site.
export const viewport: Viewport = {
  themeColor: "#07080d",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${profile.name} — ${profile.role}`,
    template: `%s — ${profile.name}`,
  },
  description: profile.headline,
  keywords: [
    "GenAI Engineer",
    "Backend Engineer",
    "LLM Agent Orchestration",
    "Multi-Agent Systems",
    "RAG",
    "Event-Driven Architecture",
    "Python",
    "Go",
    profile.name,
  ],
  authors: [{ name: profile.name, url: profile.links.github }],
  openGraph: {
    type: "website",
    url: siteUrl,
    title: `${profile.name} — ${profile.role}`,
    description: profile.headline,
    siteName: profile.name,
  },
  twitter: { card: "summary_large_image", title: `${profile.name} — ${profile.role}`, description: profile.headline },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <head>
        <PersonJsonLd />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>
          <SiteNav />
          {children}
          <SiteFooter />
          <CommandPalette />
          <AskPortfolio />
          <ViewHint />
          {/* Global "subtle delight" — console greeting + Konami reveal, every view. */}
          <EasterEggs />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
