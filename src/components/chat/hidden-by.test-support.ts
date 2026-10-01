/**
 * Test support, imported by the *.dom.test.tsx files only, never by app code.
 *
 * Walks from an element up the ancestor chain and returns the first thing that would keep a
 * phone visitor or assistive tech from perceiving it, or null when nothing does. happy-dom
 * never evaluates Tailwind, so `hidden sm:block` hides nothing there; checking the class tokens,
 * the `hidden` attribute and aria-hidden on the chain is a best-effort guard. Any variant of
 * `hidden`, `sr-only` or `invisible` counts as hiding on purpose (`sm:hidden`, `max-sm:hidden`,
 * `md:max-lg:hidden`, `!hidden`, `sm:sr-only`): the copy this guards must have none. The
 * authoritative check is the Playwright specs in e2e/views.spec.ts, which assert visibility on
 * the iPhone 13 project.
 */
const HIDING_UTILITIES = new Set(["hidden", "sr-only", "invisible"]);

/** `max-sm:hidden` and `!hidden` hide just like `hidden`: judge the utility after the last variant. */
function hidesContent(token: string): boolean {
  const utility = (token.split(":").pop() ?? "").replace(/^!/, "");
  return HIDING_UTILITIES.has(utility);
}

export function hiddenBy(el: Element): string | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    for (const token of Array.from(node.classList)) {
      if (hidesContent(token)) {
        return `${node.tagName.toLowerCase()}.${token}`;
      }
    }
    if (node.hasAttribute("hidden")) {
      return `${node.tagName.toLowerCase()}[hidden]`;
    }
    if (node.getAttribute("aria-hidden") === "true") {
      return `${node.tagName.toLowerCase()}[aria-hidden]`;
    }
  }
  return null;
}
