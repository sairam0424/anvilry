import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { CommandPalette } from "@/components/command-palette";
import { AskPortfolio } from "@/components/ask-portfolio";
import { TalkModeMount } from "@/components/chat/talk-mode-mount";
import { AnvilInlinePanel } from "@/components/chat/anvil-inline-panel";
import { AnvilCoreSurface } from "@/components/chat/anvil-core-surface";
import { WakeWordController } from "@/components/chat/wake-word-controller";
import { ViewHint } from "@/components/view-hint";
import { EasterEggs } from "@/components/game/easter-eggs";
import { PersonJsonLd, WebSiteJsonLd } from "@/components/json-ld";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { profile } from "@/lib/profile";
import { getDiscoveryBadgesEnabled } from "@/lib/flags";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const discoveryBadgesEnabled = await getDiscoveryBadgesEnabled();
  // data-scroll-behavior="smooth": Next 16 no longer overrides scroll-behavior on navigation
  // by default. We set `scroll-behavior: smooth` in globals.css and rely on it for in-page
  // anchor nav (/#work, /#contact), so opt back in explicitly. This also silences the Next 16
  // dev warning. (Reduced-motion still forces `auto` via the CSS media query — the attribute
  // only opts into the override, it doesn't defeat that.)
  //
  // suppressHydrationWarning on the three root tags: browser extensions (locator/inspector,
  // Grammarly, dark-mode, password managers, etc.) inject attributes onto <html>/<head>/<body>
  // BEFORE React hydrates, which otherwise throws a hydration-mismatch warning (e.g. the
  // `data-locator-hook-status-message` a DOM-locator extension adds to <head>). This is a
  // client-only artifact — the server HTML is clean and real visitors are unaffected — so we
  // suppress it ONLY on these three elements. The flag does NOT cascade to children, so any
  // genuine mismatch inside the app still surfaces normally.
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head suppressHydrationWarning>
        <PersonJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        {/* First focusable element — lets keyboard users skip the nav (WCAG 2.4.1). */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers discoveryBadgesEnabled={discoveryBadgesEnabled}>
          <SiteNav />
          <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </div>
          <SiteFooter />
          <CommandPalette />
          <AskPortfolio />
          {/* Single global mount for the two-way talk-mode modal — opened from the
              Chat-view "Talk" button or the ⌘K command via a shared module store. */}
          <TalkModeMount />
          {/* Single global mount for the in-place "Anvil" voice panel — the Siri-style
              surface that expands from the header orb (desktop) instead of the modal.
              Self-gates on its store (renders null when closed). */}
          <AnvilInlinePanel />
          {/* The CORE minimal Siri surface — orb-only + result card, no panel chrome.
              Self-gates on its store; flag-gated at the trigger (ORB_EXPERIENCE=core). */}
          <AnvilCoreSurface />
          {/* Opt-in wake word (off by default). Renders its persistent "Listening"
              banner + kill switch only while active, and only on the voice views. */}
          <WakeWordController />
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
