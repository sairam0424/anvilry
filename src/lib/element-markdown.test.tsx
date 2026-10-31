import { Fragment, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  elementToMarkdown,
  type ElementMarkdownOptions,
} from "./element-markdown";

/**
 * element-markdown turns the React element tree a server component returns into Markdown, without
 * rendering it to HTML. The prose pages (privacy, contact, developers, mcp) are converted this way
 * so the Markdown twin is the page itself and cannot drift from it.
 */

function Heading({
  title,
  children,
}: {
  title: string;
  titleAs?: "h1" | "h2";
  children: ReactNode;
}) {
  return (
    <section>
      <header>
        <p className="mono-label">{"// eyebrow"}</p>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  );
}
function Para({ children }: { children: ReactNode }) {
  return <p className="my-3">{children}</p>;
}
// Stands for next/link, a client reference in the server layer: it must be read, never called.
function Anchor({ href }: { href: string; children?: ReactNode }): ReactNode {
  throw new Error(`a link component must never be called (${href})`);
}
function ClientOnly({ children }: { children?: ReactNode }) {
  return <div data-client>{children}</div>;
}
function Secret(): ReactNode {
  throw new Error("an uncalled component must never run");
}

const options: ElementMarkdownOptions = {
  siteUrl: "https://example.test",
  pagePath: "/page",
  callable: new Set<unknown>([Para]),
  sections: new Set<unknown>([Heading]),
};

const md = (node: ReactNode, overrides: Partial<ElementMarkdownOptions> = {}) =>
  elementToMarkdown(node, { ...options, ...overrides });

describe("elementToMarkdown — blocks", () => {
  it("converts headings, paragraphs and a horizontal rule", () => {
    const out = md(
      <main>
        <h1>Title</h1>
        <h2 id="a">Part</h2>
        <h4>Deep</h4>
        <p>One two.</p>
        <hr />
      </main>,
    );
    expect(out).toBe("# Title\n\n## Part\n\n#### Deep\n\nOne two.\n\n---\n");
  });

  it("calls components on the allow-list and renders the unknown ones' children only", () => {
    const out = md(
      <div>
        <Para>called</Para>
        <ClientOnly>
          <p>kept</p>
        </ClientOnly>
        <Secret />
      </div>,
    );
    expect(out).toBe("called\n\nkept\n");
  });

  it("turns a section component into a heading from its title prop and drops the eyebrow", () => {
    const out = md(
      <Heading title="Privacy" titleAs="h1">
        <p>Body.</p>
      </Heading>,
    );
    expect(out).toBe("# Privacy\n\nBody.\n");
    expect(out).not.toContain("eyebrow");
  });

  it("starts a paragraph for a run of inline content inside a div, and keeps block children apart", () => {
    const out = md(
      <div>
        loose <strong>text</strong> here
        <ul>
          <li>x</li>
        </ul>
        after
      </div>,
    );
    expect(out).toBe("loose **text** here\n\n- x\n\nafter\n");
  });

  it("renders lists with nested blocks and numbered lists", () => {
    const out = md(
      <div>
        <ul>
          <li>
            <span aria-hidden="true" />
            <span>first</span>
          </li>
          <li>
            second
            <ul>
              <li>inner</li>
            </ul>
          </li>
        </ul>
        <ol>
          <li>one</li>
          <li>two</li>
        </ol>
      </div>,
    );
    expect(out).toBe("- first\n- second\n  - inner\n\n1. one\n2. two\n");
  });

  it("fences preformatted text verbatim, with a longer fence when it contains one", () => {
    const out = md(
      <div>
        <pre>{"curl -sS https://x/\n  -H 'A: b'"}</pre>
        <pre>
          <code>{"```\ninside\n```"}</code>
        </pre>
      </div>,
    );
    expect(out).toContain("```\ncurl -sS https://x/\n  -H 'A: b'\n```");
    expect(out).toContain("````\n```\ninside\n```\n````");
  });

  it("renders a block quote", () => {
    expect(
      md(
        <blockquote>
          <p>quoted</p>
        </blockquote>,
      ),
    ).toBe("> quoted\n");
  });
});

describe("elementToMarkdown — inline", () => {
  it("renders emphasis, code spans and hard breaks, and collapses whitespace like HTML", () => {
    const out = md(
      <p>
        a <em>b</em> <code>c</code>
        <br />d{" "}e
      </p>,
    );
    expect(out).toBe("a *b* `c`  \nd e\n");
  });

  it("uses a longer code fence when the code contains a backtick", () => {
    expect(
      md(
        <p>
          <code>{"a`b"}</code>
        </p>,
      ),
    ).toBe("``a`b``\n");
  });

  it("escapes characters that would start Markdown syntax in running text", () => {
    const out = md(<p>5 * 3 [x] &lt;slug&gt; \ done</p>);
    expect(out).toContain("5 \\* 3 \\[x\\] \\<slug> \\\\ done");
  });

  it("does not let text start a heading, list or quote", () => {
    expect(md(<p># not a heading</p>)).toBe("\\# not a heading\n");
    expect(md(<p>- not a list</p>)).toBe("\\- not a list\n");
    expect(md(<p>1. not a list</p>)).toBe("1\\. not a list\n");
    expect(md(<p>&gt; not a quote</p>)).toBe("\\> not a quote\n");
  });

  it("skips hidden, script, style, svg and interactive elements", () => {
    const out = md(
      <p>
        keep
        <span aria-hidden="true">decor</span>
        <script>{"alert(1)"}</script>
        <style>{"p{}"}</style>
        <svg />
        <button>Copy</button>
      </p>,
    );
    expect(out).toBe("keep\n");
  });

  it("ignores null, undefined, booleans and renders numbers", () => {
    expect(
      md(
        <p>
          {null}
          {undefined}
          {false}
          {true}last {12} messages
        </p>,
      ),
    ).toBe("last 12 messages\n");
  });

  it("flattens fragments and arrays", () => {
    const items = ["a", "b"].map((x) => <li key={x}>{x}</li>);
    expect(
      md(
        <Fragment>
          <ul>{items}</ul>
        </Fragment>,
      ),
    ).toBe("- a\n- b\n");
  });
});

describe("elementToMarkdown — links", () => {
  it("makes root-relative links absolute and leaves absolute and mailto links alone", () => {
    const out = md(
      <p>
        <a href="/contact">contact</a>, <a href="https://x.test/a">ext</a>,{" "}
        <a href="mailto:a@b.c">mail</a>
      </p>,
    );
    expect(out).toBe(
      "[contact](https://example.test/contact), [ext](https://x.test/a), [mail](mailto:a@b.c)\n",
    );
  });

  it("resolves a fragment-only link against the page the twin belongs to", () => {
    expect(
      md(
        <p>
          <a href="#errors">errors</a>
        </p>,
      ),
    ).toBe("[errors](https://example.test/page#errors)\n");
  });

  it("treats a component that is given an href like an anchor, without calling it", () => {
    expect(
      md(
        <p>
          <Anchor href="/developers#sdk">SDK</Anchor>
        </p>,
      ),
    ).toBe("[SDK](https://example.test/developers#sdk)\n");
  });

  it("encodes spaces and parentheses in a URL and falls back to the URL when there is no text", () => {
    expect(
      md(
        <p>
          <a href="/a b(c)">x</a>
        </p>,
      ),
    ).toBe("[x](https://example.test/a%20b%28c%29)\n");
    expect(
      md(
        <p>
          <a href="/bare" />
        </p>,
      ),
    ).toBe("[https://example.test/bare](https://example.test/bare)\n");
  });
});

describe("elementToMarkdown — tables", () => {
  const table = (
    <table>
      <caption className="sr-only">hidden caption</caption>
      <thead>
        <tr>
          <th>code</th>
          <th>meaning</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>a|b</td>
          <td>
            two <code>x|y</code>
          </td>
        </tr>
        <tr>
          <td>only</td>
        </tr>
      </tbody>
    </table>
  );

  it("renders a pipe table with an escaped pipe, padded rows and no caption", () => {
    expect(md(table)).toBe(
      "| code | meaning |\n| --- | --- |\n| a\\|b | two `x\\|y` |\n| only |  |\n",
    );
  });

  it("uses the first row as the header when there is no thead", () => {
    const out = md(
      <table>
        <tbody>
          <tr>
            <td>k</td>
            <td>v</td>
          </tr>
          <tr>
            <td>1</td>
            <td>2</td>
          </tr>
        </tbody>
      </table>,
    );
    expect(out).toBe("| k | v |\n| --- | --- |\n| 1 | 2 |\n");
  });

  it("renders nothing for a table with no rows", () => {
    expect(
      md(
        <div>
          <table />
          <p>after</p>
        </div>,
      ),
    ).toBe("after\n");
  });
});

describe("elementToMarkdown — failure modes", () => {
  it("throws on an async component rather than emitting a half-empty page", () => {
    async function Later() {
      return <p>x</p>;
    }
    expect(() =>
      md(
        <div>
          <Later />
        </div>,
        { callable: new Set<unknown>([Later]) },
      ),
    ).toThrow(/async/i);
  });

  it("throws on a node it cannot read", () => {
    expect(() => md(Promise.resolve("x") as unknown as ReactNode)).toThrow(
      /unsupported/i,
    );
  });

  it("returns an empty document for an empty tree", () => {
    expect(md(null)).toBe("");
  });
});
