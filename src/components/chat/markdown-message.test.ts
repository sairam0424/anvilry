import { describe, it, expect } from "vitest";
import { closeOpenMarkdown } from "@/components/chat/markdown-message";

/**
 * Unit tests for the streaming markdown preprocessor. It balances a trailing
 * UNCLOSED delimiter so a half-streamed token renders styled-then-reflows instead
 * of flashing a literal marker — and must NEVER mangle already-complete markdown.
 *
 * (The XSS posture itself lives in react-markdown's skipHtml + defaultUrlTransform —
 * verified via a real-browser render, not here. This file pins OUR logic only.)
 */
describe("closeOpenMarkdown — streaming preprocessor", () => {
  it("leaves complete markdown untouched", () => {
    expect(closeOpenMarkdown("**bold** and *italic* and `code`")).toBe(
      "**bold** and *italic* and `code`",
    );
    expect(closeOpenMarkdown("plain text, no markers")).toBe("plain text, no markers");
  });

  it("closes a trailing unclosed bold", () => {
    expect(closeOpenMarkdown("a **partial")).toBe("a **partial**");
  });

  it("closes a trailing unclosed italic", () => {
    expect(closeOpenMarkdown("an *emphasis")).toBe("an *emphasis*");
  });

  it("closes a trailing unclosed inline code", () => {
    expect(closeOpenMarkdown("run `npm")).toBe("run `npm`");
  });

  it("hides a dangling link-open so half a link doesn't render", () => {
    // "[label](partial" with no closing ) — the bracket is dropped so it reads as text.
    const out = closeOpenMarkdown("see [the docs](https://exa");
    expect(out).not.toContain("](");
    expect(out).toContain("the docs");
  });

  it("does not double-close a completed link", () => {
    const s = "see [docs](https://x.dev) now";
    expect(closeOpenMarkdown(s)).toBe(s);
  });

  it("handles bold containing nested complete italic", () => {
    const s = "**bold with *nested* inside**";
    expect(closeOpenMarkdown(s)).toBe(s);
  });

  it("is idempotent on already-balanced input", () => {
    const balanced = closeOpenMarkdown("a **partial");
    expect(closeOpenMarkdown(balanced)).toBe(balanced);
  });
});
