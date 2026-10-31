import {
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Turns the React element tree a server component returns into Markdown, without rendering it.
 *
 * Why not render to HTML and convert that: react-dom/server is not supported inside the React
 * Server Components layer a route handler runs in, and a page that links with next/link holds a
 * client reference there that cannot be rendered by it. Walking the elements the page function
 * returns needs neither, runs the same in Vitest and in the production bundle, and sees text
 * that is already decoded.
 *
 * The walk is deliberately narrow, so a page can never be half-converted unnoticed:
 *  - host elements (h1..h6, p, ul, ol, li, pre, code, table, a, strong, em, br, hr ...) are converted;
 *  - components in `callable` are pure functions of their props and are called;
 *  - components in `sections` render a heading from their `title`/`titleAs` props (the eyebrow
 *    label is decoration and is dropped);
 *  - any other component that is given a string `href` is a link (next/link is a client reference in
 *    the server layer, which cannot be called or compared reliably, so it is recognised by its prop);
 *  - any remaining component (client components, animation wrappers) contributes its children only;
 *  - script, style, svg, captions, form controls and aria-hidden elements are decoration and are dropped;
 *  - an async component or a node that is not an element throws, so the route answers a JSON error
 *    instead of serving a truncated twin.
 */

export interface ElementMarkdownOptions {
  /** Origin put in front of root-relative links, so the twin works away from the site. */
  readonly siteUrl: string;
  /** Site path of the page being converted: a fragment-only link resolves against it. */
  readonly pagePath: string;
  /** Components that are safe to call as plain functions. */
  readonly callable: ReadonlySet<unknown>;
  /** Components that render a heading from `title` and `titleAs` plus their children. */
  readonly sections: ReadonlySet<unknown>;
}

interface HostNode {
  readonly tag: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly Tree[];
}
type Tree = string | HostNode;
type Props = Record<string, unknown>;

const SKIPPED_TAGS = new Set([
  "script",
  "style",
  "svg",
  "caption",
  "noscript",
  "template",
  "iframe",
  "canvas",
  "img",
  "button",
  "input",
  "select",
  "textarea",
]);

const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "del",
  "dfn",
  "em",
  "i",
  "ins",
  "kbd",
  "label",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

/** Stands for a hard line break while whitespace is collapsed; private-use, never in page text. */
const BREAK = "\uE000";
const HEADING_TAG = /^h([1-6])$/;
const HREF_ENCODING: Readonly<Record<string, string>> = {
  " ": "%20",
  "(": "%28",
  ")": "%29",
};

// ── Stage 1: components and wrappers become plain host elements and strings ──────────────────────

function isHidden(props: Props): boolean {
  return (
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true" ||
    props.hidden === true
  );
}

function isThenable(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function expandSection(props: Props, options: ElementMarkdownOptions): Tree[] {
  const title = typeof props.title === "string" ? props.title : "";
  const tag = props.titleAs === "h1" ? "h1" : "h2";
  const heading: Tree[] =
    title === "" ? [] : [{ tag, props: {}, children: [title] }];
  return [...heading, ...expand(props.children as ReactNode, options)];
}

function expand(node: ReactNode, options: ElementMarkdownOptions): Tree[] {
  if (node === null || node === undefined || typeof node === "boolean")
    return [];
  if (typeof node === "string") return [node];
  if (typeof node === "number" || typeof node === "bigint")
    return [String(node)];
  if (Array.isArray(node))
    return node.flatMap((child) => expand(child as ReactNode, options));
  if (!isValidElement(node)) {
    throw new Error(
      "element-markdown: unsupported node (an async component or a non-element value)",
    );
  }

  const { type, props } = node as ReactElement<Props>;
  const children = props.children as ReactNode;

  if (typeof type === "string") {
    if (SKIPPED_TAGS.has(type) || isHidden(props)) return [];
    return [{ tag: type, props, children: expand(children, options) }];
  }
  if ((type as unknown) === Fragment) return expand(children, options);
  if (options.sections.has(type)) return expandSection(props, options);
  if (options.callable.has(type) && typeof type === "function") {
    const rendered: unknown = (type as (p: Props) => unknown)(props);
    if (isThenable(rendered))
      throw new Error(
        `element-markdown: async component ${type.name || "(anonymous)"} cannot be converted`,
      );
    return expand(rendered as ReactNode, options);
  }
  if (typeof props.href === "string")
    return [{ tag: "a", props, children: expand(children, options) }];
  // Client component or wrapper: what it wraps is the content.
  return expand(children, options);
}

// ── Stage 2: host tree to Markdown ───────────────────────────────────────────────────────────────

const isHost = (tree: Tree): tree is HostNode => typeof tree !== "string";

function containsBlock(tree: Tree): boolean {
  if (!isHost(tree)) return false;
  return !INLINE_TAGS.has(tree.tag) || tree.children.some(containsBlock);
}

function textContent(trees: readonly Tree[]): string {
  return trees
    .map((t) =>
      !isHost(t) ? t : t.tag === "br" ? "\n" : textContent(t.children),
    )
    .join("");
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/([*[\]`<])/g, "\\$1");
}

/** Keeps a paragraph or heading-less line from being read as a heading, list item or quote. */
function escapeBlockStart(text: string): string {
  return text
    .replace(/^(#{1,6})(?=\s|$)/gm, "\\$1")
    .replace(/^([-+>*])(?=\s|$)/gm, "\\$1")
    .replace(/^(\d+)([.)])(?=\s|$)/gm, "$1\\$2");
}

function resolveHref(href: string, options: ElementMarkdownOptions): string {
  let absolute = href;
  if (href.startsWith("#"))
    absolute = `${options.siteUrl}${options.pagePath}${href}`;
  else if (href.startsWith("/") && !href.startsWith("//"))
    absolute = `${options.siteUrl}${href}`;
  return absolute.replace(/[ ()]/g, (char) => HREF_ENCODING[char]);
}

function collapse(raw: string, breakText: string): string {
  return raw
    .replace(/[ \t\r\n\u00a0]+/g, " ")
    .replace(new RegExp(` ?${BREAK} ?`, "g"), breakText)
    .trim();
}

function codeSpan(text: string): string {
  const content = text.replace(/\s+/g, " ").trim();
  if (content === "") return "";
  const longest = Math.max(
    0,
    ...[...content.matchAll(/`+/g)].map((run) => run[0].length),
  );
  const fence = "`".repeat(longest + 1);
  const pad = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${fence}${pad}${content}${pad}${fence}`;
}

function wrapEmphasis(marker: string, raw: string): string {
  const parts = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  if (!parts || parts[2] === "") return raw;
  return `${parts[1]}${marker}${parts[2]}${marker}${parts[3]}`;
}

function inlineRaw(
  trees: readonly Tree[],
  options: ElementMarkdownOptions,
): string {
  return trees
    .map((t) => (isHost(t) ? inlineHost(t, options) : escapeText(t)))
    .join("");
}

function inlineHost(host: HostNode, options: ElementMarkdownOptions): string {
  switch (host.tag) {
    case "br":
      return BREAK;
    case "code":
      return codeSpan(textContent(host.children));
    case "strong":
    case "b":
      return wrapEmphasis("**", inlineRaw(host.children, options));
    case "em":
    case "i":
      return wrapEmphasis("*", inlineRaw(host.children, options));
    case "a": {
      const href = typeof host.props.href === "string" ? host.props.href : "";
      const text = collapse(inlineRaw(host.children, options), " ");
      if (href === "") return text;
      const target = resolveHref(href, options);
      return `[${text === "" ? target : text}](${target})`;
    }
    default:
      return inlineRaw(host.children, options);
  }
}

const inline = (trees: readonly Tree[], options: ElementMarkdownOptions) =>
  collapse(inlineRaw(trees, options), "  \n");

function renderList(
  list: HostNode,
  ordered: boolean,
  options: ElementMarkdownOptions,
): string {
  const bodies = list.children
    .filter((child): child is HostNode => isHost(child) && child.tag === "li")
    .map((item) => renderBlocks(item.children, options).join("\n"))
    .filter((body) => body !== "");
  return bodies
    .map((body, index) => {
      const marker = ordered ? `${index + 1}. ` : "- ";
      const pad = " ".repeat(marker.length);
      const lines = body
        .split("\n")
        .map((line, n) => (n === 0 || line === "" ? line : `${pad}${line}`));
      return `${marker}${lines.join("\n")}`;
    })
    .join("\n");
}

function renderPre(pre: HostNode): string {
  const text = textContent(pre.children).replace(/^\n+/, "").trimEnd();
  if (text === "") return "";
  const longest = Math.max(
    0,
    ...[...text.matchAll(/`{3,}/g)].map((run) => run[0].length),
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  const code = pre.children.find(
    (child): child is HostNode => isHost(child) && child.tag === "code",
  );
  const language =
    /(?:^|\s)language-([\w-]+)/.exec(
      String(code?.props.className ?? ""),
    )?.[1] ?? "";
  return `${fence}${language}\n${text}\n${fence}`;
}

function collectRows(trees: readonly Tree[]): HostNode[] {
  return trees
    .filter(isHost)
    .flatMap((t) => (t.tag === "tr" ? [t] : collectRows(t.children)));
}

function renderTable(table: HostNode, options: ElementMarkdownOptions): string {
  const rows = collectRows(table.children)
    .map((tr) =>
      tr.children
        .filter(
          (cell): cell is HostNode =>
            isHost(cell) && (cell.tag === "th" || cell.tag === "td"),
        )
        .map((cell) =>
          escapeCellPipes(collapse(inlineRaw(cell.children, options), " ")),
        ),
    )
    .filter((cells) => cells.length > 0);
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((cells) => cells.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const [header, ...body] = rows;
  const divider = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  return [line(header), divider, ...body.map(line)].join("\n");
}

function renderBlockHost(
  host: HostNode,
  options: ElementMarkdownOptions,
): string[] {
  const heading = HEADING_TAG.exec(host.tag);
  if (heading) {
    const text = inline(host.children, options);
    return text === "" ? [] : [`${"#".repeat(Number(heading[1]))} ${text}`];
  }
  switch (host.tag) {
    case "ul":
    case "ol": {
      const list = renderList(host, host.tag === "ol", options);
      return list === "" ? [] : [list];
    }
    case "pre": {
      const fenced = renderPre(host);
      return fenced === "" ? [] : [fenced];
    }
    case "table": {
      const table = renderTable(host, options);
      return table === "" ? [] : [table];
    }
    case "hr":
      return ["---"];
    case "blockquote": {
      const inner = renderBlocks(host.children, options).join("\n\n");
      return inner === ""
        ? []
        : [
            inner
              .split("\n")
              .map((l) => (l === "" ? ">" : `> ${l}`))
              .join("\n"),
          ];
    }
    default:
      return renderBlocks(host.children, options);
  }
}

/** Blocks of a flow container: runs of inline content become paragraphs, block children stand alone. */
function renderBlocks(
  trees: readonly Tree[],
  options: ElementMarkdownOptions,
): string[] {
  const blocks: string[] = [];
  let run: Tree[] = [];
  const flush = () => {
    const text = escapeBlockStart(inline(run, options));
    if (text !== "") blocks.push(text);
    run = [];
  };
  for (const tree of trees) {
    if (!containsBlock(tree)) {
      run.push(tree);
      continue;
    }
    flush();
    blocks.push(...(isHost(tree) ? renderBlockHost(tree, options) : []));
  }
  flush();
  return blocks;
}

export function elementToMarkdown(
  node: ReactNode,
  options: ElementMarkdownOptions,
): string {
  const blocks = renderBlocks(expand(node, options), options);
  return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}

/**
 * Escapes the pipes that would end a table cell. A pipe that follows an ODD run of backslashes is
 * already escaped (text is escaped upstream, and a code span may carry its own "\\|"); an even run
 * (including none) leaves it bare, so it gets one more backslash. Escaping every pipe blindly
 * would turn an escaped pipe into "\\\\|" and split the cell.
 */
function escapeCellPipes(text: string): string {
  return text.replace(/(\\*)\|/g, (match, slashes: string) =>
    slashes.length % 2 === 1 ? match : `${slashes}\\|`,
  );
}
