"use client";

import * as runtime from "react/jsx-runtime";
import { useMemo, type ComponentProps } from "react";

/**
 * Compile a Velite-generated MDX function-body string into a React component.
 *
 * TRUST BOUNDARY: `code` is ONLY ever the output of Velite compiling MDX from the
 * build-time `content/` directory (authored by the site owner). It is never derived
 * from user input, request params, or any runtime/untrusted source. This is the
 * standard Velite + Next.js MDX render pattern. Do NOT pass runtime-sourced strings here.
 */
function compileMDX(code: string) {
  const fn = new Function(code);
  return fn({ ...runtime }).default;
}

/** Tailwind-styled MDX primitives — editorial case-study typography on dark theme. */
const components = {
  h2: (props: ComponentProps<"h2">) => (
    <h2 className="mt-10 mb-3 text-xl font-semibold tracking-tight text-fg" {...props} />
  ),
  h3: (props: ComponentProps<"h3">) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold text-fg" {...props} />
  ),
  p: (props: ComponentProps<"p">) => <p className="my-3 leading-relaxed text-fg-muted" {...props} />,
  ul: (props: ComponentProps<"ul">) => (
    <ul className="my-4 space-y-1.5 pl-1 text-fg-muted" {...props} />
  ),
  li: (props: ComponentProps<"li">) => (
    <li className="flex gap-2 before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-accent" {...props} />
  ),
  a: (props: ComponentProps<"a">) => (
    <a className="text-accent underline-offset-2 hover:underline" {...props} />
  ),
  strong: (props: ComponentProps<"strong">) => <strong className="font-semibold text-fg" {...props} />,
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="my-5 border-l-2 border-accent/60 bg-bg-surface/60 py-2 pl-4 text-sm italic text-fg-muted"
      {...props}
    />
  ),
  code: (props: ComponentProps<"code">) => (
    <code className="rounded bg-bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-violet" {...props} />
  ),
};

export function MDXContent({ code }: { code: string }) {
  // Compiling an MDX string into a component is inherently render-time (that's what MDX
  // is); useMemo keeps the result stable across renders, so the static-components rule's
  // state-reset concern doesn't apply here.
  const Component = useMemo(() => compileMDX(code), [code]);
  // eslint-disable-next-line react-hooks/static-components
  return <Component components={components} />;
}
