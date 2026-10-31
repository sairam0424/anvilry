import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_TWINS, isPageTwin } from "./page-twins";

describe("PAGE_TWINS", () => {
  it("lists the ten pages that have a Markdown twin", () => {
    expect([...PAGE_TWINS].sort()).toEqual([
      "about",
      "articles",
      "contact",
      "decisions",
      "developers",
      "mcp",
      "notes",
      "privacy",
      "projects",
      "work",
    ]);
  });

  it("names only pages that exist in the app tree", () => {
    for (const page of PAGE_TWINS) {
      const file = join(process.cwd(), "src", "app", page, "page.tsx");
      expect(() => readFileSync(file, "utf-8"), page).not.toThrow();
    }
  });

  it("does not list the pages that stay HTML-only", () => {
    for (const page of ["resume", "search", "stats"]) {
      expect(isPageTwin(page), page).toBe(false);
    }
  });
});

describe("isPageTwin", () => {
  it("accepts every listed page and nothing else", () => {
    for (const page of PAGE_TWINS) expect(isPageTwin(page), page).toBe(true);
    for (const other of [
      "",
      "About",
      "about.md",
      "/about",
      "index",
      "__proto__",
      "constructor",
      "toString",
    ]) {
      expect(isPageTwin(other), other).toBe(false);
    }
  });
});
