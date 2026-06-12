"use client";

import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";

/**
 * Renders ONE assistant text segment as markdown — safe by construction:
 *  - react-markdown emits a React vdom (NEVER dangerouslySetInnerHTML).
 *  - `skipHtml` drops raw model HTML entirely, so <script>/<img onerror> never
 *    become DOM nodes (keeps the parse-cards.test.ts inert-HTML guarantee).
 *  - default urlTransform allows only http(s)/mailto/etc and strips javascript:/
 *    data: hrefs to '' (so we deliberately do NOT override it).
 *  - rehype-sanitize is defense-in-depth (GitHub's defaultSchema).
 * Card tokens never reach here — parse-cards.ts extracts them first; this only
 * receives a plain text segment.
 *
 * Memoized on `text`: settled bubbles never re-parse; only the streaming (last)
 * segment re-parses per token, and that's a single short string.
 */

/**
 * Balance a trailing unclosed markdown delimiter while streaming, so a half-typed
 * **bold or `code shows styled-then-reflows instead of flashing literal markers.
 * Cosmetic only — react-markdown already renders partial markdown crash-safe.
 */
export function closeOpenMarkdown(text: string): string {
  let out = text;
  // Dangling link-open: hide "[label](partial" until the closer streams in.
  const lastOpenParen = out.lastIndexOf("](");
  if (lastOpenParen !== -1 && !out.slice(lastOpenParen).includes(")")) {
    const lastBracket = out.lastIndexOf("[", lastOpenParen);
    if (lastBracket !== -1) out = out.slice(0, lastBracket) + out.slice(lastBracket + 1, lastOpenParen);
  }
  // Balance inline code backticks (odd count -> append one).
  if ((out.match(/`/g)?.length ?? 0) % 2 === 1) out += "`";
  // Balance bold (**) then italic (*): count unescaped runs.
  const boldRuns = out.match(/\*\*/g)?.length ?? 0;
  if (boldRuns % 2 === 1) out += "**";
  const singleStars = (out.match(/(?<!\*)\*(?!\*)/g)?.length ?? 0);
  if (singleStars % 2 === 1) out += "*";
  return out;
}

const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-fg">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-fg">{children}</h3>,
  h3: ({ children }) => <h3 className="mt-3 mb-1 text-sm font-semibold text-fg">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border-strong pl-3 text-fg-muted">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-bg-base p-3 font-mono text-xs">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-accent underline underline-offset-2 hover:text-accent-strong"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};

export const MarkdownMessage = memo(function MarkdownMessage({ text }: { text: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      skipHtml
      components={components}
    >
      {closeOpenMarkdown(text)}
    </Markdown>
  );
});
