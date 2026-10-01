/**
 * Test support, imported by the *.dom.test.tsx files only, never by app code.
 *
 * Walks from an element up the ancestor chain and returns the first thing that would keep a
 * phone visitor or assistive tech from perceiving it, or null when nothing does. happy-dom
 * never evaluates Tailwind, so `hidden sm:block` hides nothing there; checking the class tokens
 * and aria-hidden on the chain is the strongest claim such a test can make. A responsive
 * `x:hidden` token counts as hiding on purpose: the copy this guards must have none. Real
 * rendering is covered by the Playwright specs in e2e/views.spec.ts.
 */
export function hiddenBy(el: Element): string | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    for (const token of Array.from(node.classList)) {
      if (
        token === "hidden" ||
        token === "sr-only" ||
        token === "invisible" ||
        /^[a-z0-9]+:hidden$/.test(token)
      ) {
        return `${node.tagName.toLowerCase()}.${token}`;
      }
    }
    if (node.getAttribute("aria-hidden") === "true") {
      return `${node.tagName.toLowerCase()}[aria-hidden]`;
    }
  }
  return null;
}
