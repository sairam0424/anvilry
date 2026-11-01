import type { Metadata } from "next";
import { DevelopersJsonLd } from "@/components/json-ld-api";
import { Section } from "@/components/ui/section";
import { buildOpenApiDocument } from "@/lib/openapi";
import { profile } from "@/lib/profile";
import {
  AuthenticationSection,
  CliSection,
  DeprecationNote,
  DiscoverySection,
  EndpointsSection,
  ErrorCodesSection,
  ErrorsSection,
  IntroSection,
  LimitsSection,
  MarkdownSection,
  McpSection,
  QuickstartSection,
  RateLimitsSection,
  ResponseHeadersSection,
  SdkSection,
  VersioningSection,
} from "./sections";

const description = `Anvilry API documentation and developer guide: a free, read-only API, OpenAPI 3.1 description, Markdown content negotiation, llms.txt and an MCP server over ${profile.name}'s portfolio. No API keys.`;

export const metadata: Metadata = {
  title: "Anvilry API documentation",
  description,
  alternates: { canonical: "/developers" },
  openGraph: {
    type: "website",
    url: "/developers",
    title: `Anvilry API documentation — ${profile.name}`,
    description,
  },
};

/**
 * The developer guide is a list of section components (./sections). The Markdown twin converts this
 * page's elements, so what the sections render is what /developers.md says.
 */
export default function DevelopersPage() {
  const openApi = buildOpenApiDocument();

  return (
    <main className="flex-1">
      <Section
        label="// developers"
        title="Build on Anvilry: API documentation"
        titleAs="h1"
      >
        <IntroSection />
        <QuickstartSection openApi={openApi} />
        <AuthenticationSection />
        <EndpointsSection openApi={openApi} />
        <div className="max-w-2xl">
          <VersioningSection />
          <RateLimitsSection />
        </div>
        <ResponseHeadersSection />
        <div className="max-w-2xl">
          <DeprecationNote />
          <MarkdownSection />
          <ErrorsSection />
        </div>
        <ErrorCodesSection />
        <div className="max-w-2xl">
          <McpSection />
          <SdkSection />
          <CliSection openApi={openApi} />
          <DiscoverySection />
          <LimitsSection />
        </div>
      </Section>
      <DevelopersJsonLd />
    </main>
  );
}
