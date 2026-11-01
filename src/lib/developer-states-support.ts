import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import type { CliCommand } from "@/lib/developer-tools";

/**
 * Test support: forces the one state /developers, its Markdown twin and llms.txt take from outside
 * themselves, so a test can look at both values without touching the real one: CLI.published
 * (src/lib/developer-tools.ts), which the owner flips after `npm publish`. The state is forced by
 * replacing that module; the test then imports the code under test afresh. Call
 * `restoreDeveloperState()` in afterEach.
 */

/** The command table the forced module offers, so a test can look for exact rows. */
export const COMMANDS: readonly CliCommand[] = [
  {
    name: "profile",
    summary: "Print the owner's profile",
    usage: "anvilry profile [--json]",
  },
  {
    name: "search",
    summary: "Search work, projects and skills",
    usage: "anvilry search <query>",
  },
];

export interface DeveloperState {
  /** Value of CLI.published. */
  cliPublished: boolean;
}

export function forceDeveloperState({ cliPublished }: DeveloperState): void {
  vi.resetModules();
  vi.doMock("@/lib/developer-tools", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/developer-tools")>();
    return {
      ...real,
      CLI: { ...real.CLI, published: cliPublished },
      CLI_COMMANDS: COMMANDS,
    };
  });
}

export function restoreDeveloperState(): void {
  vi.doUnmock("@/lib/developer-tools");
  vi.resetModules();
}

/**
 * The source of the developer guide: the page and every file of its sections folder. Tests that check
 * the anchors (`id="sdk"`) a redirect or llms.txt points at read this, so they follow the guide when it
 * is split into more files.
 */
export function developerGuideSource(): string {
  const dir = join(process.cwd(), "src", "app", "developers");
  const sections = readdirSync(join(dir, "sections"))
    .filter((file) => /\.tsx$/.test(file) && !/\.test\./.test(file))
    .map((file) => readFileSync(join(dir, "sections", file), "utf-8"));
  return [readFileSync(join(dir, "page.tsx"), "utf-8"), ...sections].join("\n");
}
