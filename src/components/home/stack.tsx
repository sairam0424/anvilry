import type { CSSProperties } from "react";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { Tooltip } from "@/components/ui/tooltip";
import { StackGlyph, StackIcon } from "@/components/stack-icons";
import { stackBrandVars, stackItems } from "@/lib/stack";

/**
 * Home "Stack" icon wall — the tools behind the case studies, as 40px brand glyphs.
 *
 * Server component (no "use client"): the list, the links and the inline SVG paths render
 * on the server and ship as HTML + RSC payload, not client JavaScript. <Reveal> and
 * <Tooltip> are the only client boundaries and both are already in the "/" first-load set
 * (providers.tsx mounts TooltipProvider once). The <a> elements are passed to <Tooltip> as
 * children, so their SVG path data stays out of the client module graph
 * (node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md,
 * "Passing Server Components as props").
 *
 * Accessibility rules this component follows:
 *   - ONE accessible-name source per link: aria-label. The SVG is aria-hidden and the
 *     caption repeats the same text, so WCAG 2.5.3 (Label in Name) holds and a screen
 *     reader hears "Python, link" once.
 *   - Tooltips never open on touch (Radix behaviour), so the caption is gated on input
 *     capability, not viewport width: coarse-pointer devices (phones AND tablets) show a
 *     visible mono caption under every tile; fine-pointer devices hide it and the tooltip
 *     carries the name plus the skill group.
 *   - Hit target: 40px glyph + p-2 = 56x56px, above the 44px WCAG 2.5.5 floor.
 *   - Focus ring: the global :focus-visible rule in globals.css (3px --accent outline).
 *   - Hover tint is theme-aware (bg-fg/5), so it is visible in light mode too.
 *
 * Colour: .stack-icon (globals.css) paints --fg-muted at rest and the per-tile
 * --brand-dark / --brand-light variable on hover and focus. Colour transitions are not
 * motion, so they are allowed under prefers-reduced-motion.
 */
export function Stack() {
  return (
    <Section id="stack" label="// tools i ship with" title="Stack">
      <Reveal>
        <ul
          aria-label="Tools and technologies"
          className="dot-grid flex flex-wrap gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 sm:gap-4 sm:p-6"
        >
          {stackItems.map((item) => (
            <li key={item.name} className="flex">
              <Tooltip
                content={
                  <>
                    {item.name}
                    <span className="ml-1.5 text-fg-muted">{item.group}</span>
                  </>
                }
              >
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.name}
                  className="stack-icon flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-fg/5"
                  style={stackBrandVars(item) as CSSProperties}
                >
                  {item.kind === "brand" ? (
                    <StackIcon icon={item.icon} size={40} />
                  ) : (
                    <StackGlyph glyph={item.glyph} size={40} />
                  )}
                  <span
                    className="font-mono text-[11px] leading-none whitespace-nowrap text-fg-muted pointer-fine:hidden"
                    aria-hidden="true"
                  >
                    {item.name}
                  </span>
                </a>
              </Tooltip>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
