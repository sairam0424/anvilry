/**
 * Every section component of /developers, in one list. The page imports from here, and so does the
 * Markdown twin (src/lib/page-markdown-prose.ts), which calls exactly these components when it
 * converts the page. A component that is not exported here would vanish from /developers.md; the
 * test next to this file fails when one is missing.
 */
export { ApiTable } from "./api-table";
export { CliCommandsTable, CliInstall, CliSection } from "./cli";
export {
  AuthenticationSection,
  DeprecationNote,
  EndpointsSection,
  RateLimitsSection,
  ResponseHeadersSection,
  VersioningSection,
} from "./contract";
export {
  DiscoverySection,
  ErrorCodesSection,
  ErrorsSection,
  LimitsSection,
  MarkdownSection,
  McpSection,
  SdkSection,
} from "./guides";
export { IntroSection, QuickstartSection } from "./intro";
