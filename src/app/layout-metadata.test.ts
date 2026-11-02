import { describe, expect, it, vi } from "vitest";

// layout.tsx pulls in next/font/google and a dozen client components that none of these tests
// is about. They are stubbed so the real exported `metadata` object can be read on its own.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-sans" }),
  JetBrains_Mono: () => ({ variable: "--font-mono" }),
}));
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }));
vi.mock("@/components/providers", () => ({ Providers: () => null }));
vi.mock("@/components/site-nav", () => ({ SiteNav: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/ask-portfolio", () => ({ AskPortfolio: () => null }));
vi.mock("@/components/chat/talk-mode-mount", () => ({
  TalkModeMount: () => null,
}));
vi.mock("@/components/chat/anvil-inline-panel", () => ({
  AnvilInlinePanel: () => null,
}));
vi.mock("@/components/chat/anvil-core-surface", () => ({
  AnvilCoreSurface: () => null,
}));
vi.mock("@/components/chat/wake-word-controller", () => ({
  WakeWordController: () => null,
}));
vi.mock("@/components/view-hint", () => ({ ViewHint: () => null }));
vi.mock("@/components/game/easter-eggs", () => ({ EasterEggs: () => null }));
vi.mock("@/components/open-to-work-banner", () => ({
  OpenToWorkBanner: () => null,
}));
vi.mock("@/components/json-ld", () => ({
  PersonJsonLd: () => null,
  OrganizationJsonLd: () => null,
  WebSiteJsonLd: () => null,
  FaqJsonLd: () => null,
}));

/** The ownership token Google Search Console issued for https://anvilry.vercel.app (HTML-tag method). */
const GOOGLE_SITE_VERIFICATION = "Ut4TGdySKH8adIfZZc46tCtoyPRMpXwPN7BOg_5omSA";

describe("layout metadata: search engine ownership", () => {
  it("declares the Google Search Console verification token, which Next renders as a google-site-verification meta tag", async () => {
    const { metadata } = await import("./layout");
    expect(metadata.verification?.google).toBe(GOOGLE_SITE_VERIFICATION);
  });

  it("adds only that tag: the canonical base and the crawl rules are unchanged", async () => {
    const { metadata } = await import("./layout");
    expect(String(metadata.metadataBase)).toBe("https://anvilry.vercel.app/");
    expect(metadata.robots).toEqual({ index: true, follow: true });
  });
});
