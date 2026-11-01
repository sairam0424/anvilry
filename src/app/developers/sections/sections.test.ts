import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * /developers is a short page made of section components (this folder). The Markdown twin of the
 * page is made by calling the page function and walking the elements it returns, and the walker
 * (src/lib/element-markdown.ts) calls only the components it is told are pure; the others it reads
 * through, keeping only their children. A section component the twin was not told about would
 * therefore vanish from /developers.md without any error. index.ts is the one list both the page and
 * the twin read, and these tests keep it complete and the pieces small.
 */

const DIR = join(process.cwd(), "src", "app", "developers", "sections");
const PAGE = join(process.cwd(), "src", "app", "developers", "page.tsx");
const MAX_FUNCTION_LINES = 50;
const MAX_FILE_LINES = 500;

const sourceFiles = () =>
  readdirSync(DIR).filter(
    (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== "index.ts",
  );

/** Every `function Name` at the left margin, with its length up to the closing brace. */
function functionsOf(
  source: string,
): { name: string; lines: number; exported: boolean }[] {
  const lines = source.split("\n");
  return lines.flatMap((line, start) => {
    const found = /^(export (?:default )?)?function (\w+)/.exec(line);
    if (!found) return [];
    const end = lines.findIndex((l, i) => i > start && l === "}");
    return [
      { name: found[2], lines: end - start + 1, exported: Boolean(found[1]) },
    ];
  });
}

describe("the /developers section components", () => {
  it("are all exported by index.ts, which is the list the Markdown twin calls", async () => {
    const index = (await import("./index")) as Record<string, unknown>;
    const declared = sourceFiles().flatMap((file) =>
      functionsOf(readFileSync(join(DIR, file), "utf8"))
        .filter((f) => f.exported)
        .map((f) => f.name),
    );
    expect(declared.length).toBeGreaterThanOrEqual(12);
    expect(Object.keys(index).sort()).toEqual([...declared].sort());
    for (const [name, value] of Object.entries(index))
      expect(typeof value, name).toBe("function");
  });

  it("keep every function under 50 lines", () => {
    const tooLong = sourceFiles().flatMap((file) =>
      functionsOf(readFileSync(join(DIR, file), "utf8"))
        .filter((f) => f.lines > MAX_FUNCTION_LINES)
        .map((f) => `${file}: ${f.name} has ${f.lines} lines`),
    );
    expect(tooLong).toEqual([]);
  });

  it("keep every file under 500 lines, and the page under 500 with a short DevelopersPage", () => {
    for (const file of sourceFiles()) {
      expect(
        readFileSync(join(DIR, file), "utf8").split("\n").length,
        file,
      ).toBeLessThan(MAX_FILE_LINES);
    }
    const page = readFileSync(PAGE, "utf8");
    expect(page.split("\n").length).toBeLessThan(MAX_FILE_LINES);
    const developers = functionsOf(page).find(
      (f) => f.name === "DevelopersPage",
    );
    expect(developers?.lines).toBeLessThanOrEqual(MAX_FUNCTION_LINES);
  });
});
