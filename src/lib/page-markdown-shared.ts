import { SITE_URL } from "@/lib/site-url";

/** Helpers every page twin builder shares (the style of home-markdown.ts). */

/** Absolute URL of a site path: a twin is read away from the site, so it never links relatively. */
export const abs = (path: string): string => `${SITE_URL}${path}`;

/** Text that sits inside `[...]` of a Markdown link: brackets and backslashes would end the label early. */
export const linkText = (text: string): string =>
  text.replace(/([\\[\]])/g, "\\$1");

/** `[name](url)` for an HTML page, followed by the link to its Markdown twin. */
export function pageAndTwinLinks(name: string, path: string): string {
  return `[${linkText(name)}](${abs(path)}) ([Markdown](${abs(path)}.md))`;
}

/** A level-2 section, or nothing when it has no lines (so an empty list never leaves a bare heading). */
export function section(title: string, lines: readonly string[]): string {
  return lines.length > 0 ? `## ${title}\n\n${lines.join("\n")}\n` : "";
}

/** Joins the parts of a document, skipping empty ones, and ends the file with one newline. */
export function joinParts(parts: readonly string[]): string {
  return `${parts
    .filter((part) => part !== "")
    .join("\n")
    .trimEnd()}\n`;
}

/** The closing line of every twin: where the HTML page is, as the homepage twin says it. */
export function twinFooter(pagePath: string): string {
  const url = abs(pagePath);
  return `---\n\nThis is the Markdown version of [${url}](${url}). Browsers get the HTML page from the same URL.\n`;
}
