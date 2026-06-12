import { describe, it, expect } from "vitest";
import { allProjects, allWork } from "@/lib/content";
import { parseCards, hasCardToken } from "@/components/chat/parse-cards";

/**
 * Prompt-injection / XSS guard for the chat card layer. The model's text reaches
 * the DOM as React text nodes (auto-escaped) and the ONLY structured output it can
 * influence is a card token, which is resolved against the Velite slug allowlist.
 * These tests pin that fail-closed contract: a hostile model turn can neither
 * inject markup nor conjure a card/href for content that doesn't exist.
 */

const realProject = allProjects[0].slug;
const realWork = allWork.find((w) => w.slug === "aava-code")?.slug ?? allWork[0].slug;

describe("parseCards — allowlist resolution", () => {
  it("resolves a valid project token to the real content item", () => {
    const segs = parseCards(`Here it is. [[card:project:${realProject}]]`);
    const card = segs.find((s) => s.type === "project");
    expect(card).toBeTruthy();
    if (card?.type === "project") {
      expect(card.project.slug).toBe(realProject);
      // The href is the server-derived Velite url, never model-authored.
      expect(card.project.url).toBe(`/projects/${realProject}`);
    }
  });

  it("resolves a valid work token to the real content item", () => {
    const segs = parseCards(`[[card:work:${realWork}]]`);
    const card = segs.find((s) => s.type === "work");
    expect(card?.type === "work" && card.work.slug).toBe(realWork);
  });

  it("returns plain text unchanged when there are no tokens", () => {
    const segs = parseCards("Just a normal answer with no card.");
    expect(segs).toEqual([{ type: "text", text: "Just a normal answer with no card." }]);
  });
});

describe("parseCards — fail closed on hostile / unknown input", () => {
  it("DROPS an unknown/hallucinated slug (no card, no echoed token)", () => {
    const segs = parseCards("Sure. [[card:project:totally-made-up-repo]] done.");
    expect(segs.some((s) => s.type === "project" || s.type === "work")).toBe(false);
    // The raw token must not survive into rendered text.
    const text = segs.map((s) => (s.type === "text" ? s.text : "")).join("");
    expect(text).not.toContain("[[card:");
    expect(text).not.toContain("totally-made-up-repo");
  });

  it("ignores a malformed token kind (only project|work are valid)", () => {
    const segs = parseCards("[[card:admin:secrets]] [[card:script:x]]");
    expect(segs.every((s) => s.type === "text")).toBe(true);
  });

  it("never treats an injected URL/path as an href — slug charset is locked", () => {
    // Slugs are [a-z0-9-] only; a token trying to smuggle a path or scheme can't match.
    const hostile = [
      "[[card:project:../../etc/passwd]]",
      "[[card:project:javascript:alert(1)]]",
      "[[card:work:https://evil.example.com]]",
      "[[card:project:UPPER_and_underscores]]",
    ].join(" ");
    const segs = parseCards(hostile);
    expect(segs.some((s) => s.type !== "text")).toBe(false);
  });

  it("keeps raw HTML / script as inert TEXT (no parsing, no resolution)", () => {
    const evil = '<img src=x onerror=alert(1)> <script>alert(2)</script> [[card:project:nope]]';
    const segs = parseCards(evil);
    // Everything stays in text segments — the caller renders text nodes, so this
    // string is displayed literally and never executes.
    expect(segs.every((s) => s.type === "text")).toBe(true);
    const text = segs.map((s) => (s.type === "text" ? s.text : "")).join("");
    expect(text).toContain("<script>"); // present as literal text, not a DOM node
  });

  it("hasCardToken detects a token without mutating regex state across calls", () => {
    const s = `x [[card:project:${realProject}]] y`;
    expect(hasCardToken(s)).toBe(true);
    expect(hasCardToken(s)).toBe(true); // stable on repeat (lastIndex reset)
    expect(hasCardToken("no token here")).toBe(false);
  });
});
