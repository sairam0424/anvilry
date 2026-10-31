import { describe, expect, it } from "vitest";
import {
  PRODUCES,
  appendVary,
  mentionsMarkdown,
  negotiate,
} from "./accept-negotiation";

/**
 * Content negotiation for the pages that have a Markdown twin (acceptmarkdown.com).
 * The rules are the published ones: rank by q, break ties by specificity and then by the
 * client's order, never pick a type the client marked q=0, treat a missing Accept or "* / *"
 * as "serve the default", and return null (406) only when nothing we can produce is
 * acceptable. "includes('text/markdown')" is the classic wrong implementation: a real Chrome
 * header must never select Markdown.
 */

const HTML = "text/html";
const MD = "text/markdown";

describe("negotiate — the published test vectors", () => {
  it.each([
    ["text/markdown", MD],
    ["text/markdown, text/html;q=0.8", MD],
    ["text/html", HTML],
    ["text/markdown;q=0, text/html", HTML],
  ])("Accept: %s -> %s", (accept, expected) => {
    expect(negotiate(accept, PRODUCES)).toBe(expected);
  });

  it("a missing Accept header means no constraint: serve the default (HTML)", () => {
    expect(negotiate(null, PRODUCES)).toBe(HTML);
    expect(negotiate(undefined, PRODUCES)).toBe(HTML);
  });

  it("an empty or blank Accept header is treated like a missing one", () => {
    expect(negotiate("", PRODUCES)).toBe(HTML);
    expect(negotiate("   ", PRODUCES)).toBe(HTML);
  });
});

describe("negotiate — wildcards, q-values and specificity", () => {
  it("*/* and text/* mean anything is fine: the default wins", () => {
    expect(negotiate("*/*", PRODUCES)).toBe(HTML);
    expect(negotiate("text/*", PRODUCES)).toBe(HTML);
  });

  it("a real Chrome header never selects Markdown", () => {
    const chrome =
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";
    expect(negotiate(chrome, PRODUCES)).toBe(HTML);
  });

  it("a Markdown-first agent header selects Markdown even with fallbacks", () => {
    expect(negotiate("text/markdown, text/html, */*", PRODUCES)).toBe(MD);
    expect(negotiate("text/markdown, text/html;q=0.8, */*;q=0.1", PRODUCES)).toBe(MD);
  });

  it("a higher q for HTML beats an earlier Markdown entry", () => {
    expect(negotiate("text/markdown;q=0.2, text/html;q=0.9", PRODUCES)).toBe(HTML);
  });

  it("equal q breaks the tie by the client's order", () => {
    expect(negotiate("text/markdown, text/html", PRODUCES)).toBe(MD);
    expect(negotiate("text/html, text/markdown", PRODUCES)).toBe(HTML);
  });

  it("a specific range overrides a wildcard regardless of q", () => {
    // text/html;q=0 must reject HTML even though */*;q=1 would otherwise allow it.
    expect(negotiate("text/html;q=0, */*;q=1", PRODUCES)).toBe(MD);
    expect(negotiate("text/markdown;q=0, */*;q=1", PRODUCES)).toBe(HTML);
  });

  it("is case-insensitive for type names and the q parameter", () => {
    expect(negotiate("TEXT/Markdown;Q=1, text/html;q=0.1", PRODUCES)).toBe(MD);
  });

  it("ignores parameters other than q, such as charset or level", () => {
    expect(negotiate("text/markdown; charset=utf-8, text/html;q=0.5", PRODUCES)).toBe(MD);
  });

  it("clamps q to 0..1 and ignores an unparseable q", () => {
    expect(negotiate("text/markdown;q=7, text/html;q=0.9", PRODUCES)).toBe(MD);
    expect(negotiate("text/markdown;q=abc, text/html;q=0.5", PRODUCES)).toBe(MD);
  });

  it("skips malformed entries instead of failing", () => {
    expect(negotiate(",,not-a-type, text/markdown,", PRODUCES)).toBe(MD);
  });
});

describe("negotiate — when nothing is acceptable", () => {
  it("returns null for a client that accepts only types we cannot produce", () => {
    expect(negotiate("application/pdf", PRODUCES)).toBeNull();
    expect(negotiate("application/json, image/png;q=0.5", PRODUCES)).toBeNull();
  });

  it("returns null when everything we can produce is explicitly rejected", () => {
    expect(negotiate("text/html;q=0, text/markdown;q=0, application/json", PRODUCES)).toBeNull();
  });

  it("serves the default when the header only excludes Markdown (the guide's gotcha)", () => {
    expect(negotiate("text/markdown;q=0", PRODUCES)).toBe(HTML);
  });

  it("returns null for a Markdown-only producer that the client rejected", () => {
    expect(negotiate("text/markdown;q=0", [MD])).toBeNull();
  });
});

describe("mentionsMarkdown", () => {
  it("is true only when the header names text/markdown", () => {
    expect(mentionsMarkdown("text/markdown")).toBe(true);
    expect(mentionsMarkdown("text/html, TEXT/MARKDOWN;q=0.1")).toBe(true);
    expect(mentionsMarkdown("text/html,*/*;q=0.8")).toBe(false);
    expect(mentionsMarkdown(null)).toBe(false);
  });
});

describe("appendVary", () => {
  it("sets Vary: Accept when there is no Vary header", () => {
    const h = new Headers();
    appendVary(h, "Accept");
    expect(h.get("vary")).toBe("Accept");
  });

  it("appends to an existing Vary without dropping it", () => {
    const h = new Headers({ vary: "rsc, next-router-state-tree" });
    appendVary(h, "Accept");
    expect(h.get("vary")).toBe("rsc, next-router-state-tree, Accept");
  });

  it("does not duplicate a token that is already there, in any case", () => {
    const h = new Headers({ vary: "accept-encoding, ACCEPT" });
    appendVary(h, "Accept");
    expect(h.get("vary")).toBe("accept-encoding, ACCEPT");
  });

  it("leaves a Vary: * alone", () => {
    const h = new Headers({ vary: "*" });
    appendVary(h, "Accept");
    expect(h.get("vary")).toBe("*");
  });
});
