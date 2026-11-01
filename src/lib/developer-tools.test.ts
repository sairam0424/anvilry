import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { API_V1_BASE } from "@/lib/api-policy";
import { SITE_URL } from "@/lib/site-url";
import {
  CLI,
  CLI_COMMANDS,
  cliHeading,
  cliInstallLines,
  cliLlmsLine,
  cliSourceNote,
  cliStatus,
  type CliCommand,
  type CliInfo,
} from "./developer-tools";

/**
 * The CLI is a separate package (cli/, npm name `anvilry`) that the owner publishes with their own
 * credentials. The site must tell the truth at every moment, so every sentence about it comes from
 * CLI.published: while it is false nothing advertises `npx anvilry`, and flipping that one flag is
 * what makes /developers, llms.txt and the Markdown twin show the install commands and the command list.
 * The helpers take the CLI as a parameter so both states are tested without touching the real flag.
 */

const unpublished: CliInfo = { ...CLI, published: false };
const published: CliInfo = { ...CLI, published: true };

const commands: readonly CliCommand[] = [
  { name: "profile", summary: "Print the profile", usage: "anvilry profile" },
  {
    name: "search",
    summary: "Search the portfolio",
    usage: "anvilry search <query>",
  },
];

/**
 * RELEASE GATE. CLI.published is the one switch that makes the site say `npx anvilry` works. It must
 * not be flipped by accident, so this pins it: flip this test together with publishing the package,
 * in the same commit as the owner's `npm publish`. The wording tests below pass the flag as a
 * parameter, so they keep covering both states either way.
 */
describe("the release gate", () => {
  it("has CLI.published false until the package is on npm (flip this together with publishing the package)", () => {
    expect(CLI.published).toBe(false);
  });
});

describe("CLI", () => {
  it("describes the npm package `anvilry` consistently", () => {
    expect(CLI.name).toBe("anvilry");
    expect(CLI.registry).toBe("npm");
    expect(CLI.runCommand).toBe("npx anvilry");
    expect(CLI.installCommand).toBe("npm install --global anvilry");
    expect(CLI.packageUrl).toBe("https://www.npmjs.com/package/anvilry");
    expect(CLI.sourcePath).toBe("cli");
  });
});

describe("the CLI wording while it is not published", () => {
  it("heads the section as command-line use and says there is no published package", () => {
    expect(cliHeading(unpublished)).toBe("Anvilry command-line use");
    expect(cliStatus(unpublished)).toBe(
      "There is no published CLI package for Anvilry.",
    );
  });

  it("adds one honest sentence: the source is in the repository and not on npm yet", () => {
    const note = cliSourceNote(unpublished) ?? "";
    expect(note).toContain("cli/");
    expect(note).toMatch(/not on npm yet/);
  });

  it("offers no install or run command", () => {
    expect(cliInstallLines(unpublished)).toEqual([]);
  });

  it("keeps the llms.txt line as it was, plus the source sentence, and never names a command", () => {
    const line = cliLlmsLine(unpublished, commands, SITE_URL);
    expect(line).toBe(
      `- Anvilry command-line use: ${SITE_URL}/developers#cli (there is no published CLI package; the page shows curl recipes against ${SITE_URL}${API_V1_BASE}; the CLI source is in the repository's cli/ directory and is not yet on npm)`,
    );
    for (const advertised of [
      CLI.runCommand,
      CLI.installCommand,
      CLI.packageUrl,
      "profile",
      "search",
    ]) {
      expect(line).not.toContain(advertised);
    }
  });
});

describe("the CLI wording once it is published", () => {
  it("heads the section as Anvilry CLI and names the npm package", () => {
    expect(cliHeading(published)).toBe("Anvilry CLI");
    expect(cliStatus(published)).toBe(
      "Anvilry has an official command-line tool, the npm package anvilry.",
    );
  });

  it("drops the not-yet-published note", () => {
    expect(cliSourceNote(published)).toBeNull();
  });

  it("offers the run and install commands", () => {
    expect(cliInstallLines(published)).toEqual([
      "npx anvilry",
      "npm install --global anvilry",
    ]);
  });

  it("names the package, both commands, the package page and every command in the llms.txt line", () => {
    const line = cliLlmsLine(published, commands, SITE_URL);
    expect(line.startsWith("- Anvilry CLI: ")).toBe(true);
    expect(line).toContain(`${SITE_URL}/developers#cli`);
    expect(line).toContain("npx anvilry");
    expect(line).toContain("npm install --global anvilry");
    expect(line).toContain("https://www.npmjs.com/package/anvilry");
    expect(line).toContain("profile, search");
    expect(line).not.toMatch(/no published CLI/i);
  });
});

describe("CLI_COMMANDS", () => {
  it("is a list of commands that each have a name, a summary and a usage line", () => {
    for (const command of CLI_COMMANDS) {
      expect(command.name, JSON.stringify(command)).toMatch(
        /^[a-z][a-z0-9-]*$/,
      );
      expect(command.summary.length, command.name).toBeGreaterThan(5);
      expect(command.usage.length, command.name).toBeGreaterThan(0);
    }
    expect(new Set(CLI_COMMANDS.map((c) => c.name)).size).toBe(
      CLI_COMMANDS.length,
    );
  });
});

/**
 * The site shows a copy of the CLI's command table, so a command added to or changed in cli/ must
 * fail here until the site list follows. The file is read from the package itself.
 */
const CLI_DIR = join(process.cwd(), CLI.sourcePath);
const COMMANDS_FILE = join(CLI_DIR, "lib", "commands.mjs");
const hasSource = existsSync(COMMANDS_FILE);

function isCommandTable(value: unknown): value is CliCommand[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (c) =>
        typeof c?.name === "string" &&
        typeof c?.summary === "string" &&
        typeof c?.usage === "string",
    )
  );
}

describe("the site copy of the CLI against the package in cli/", () => {
  // Flipping CLI.published without the package in the repository would advertise a tool that does not exist.
  it.skipIf(!CLI.published)("has the package's source in the repository once the CLI is declared published", () => {
    expect(hasSource, `${CLI.sourcePath}/lib/commands.mjs`).toBe(true);
    expect(CLI_COMMANDS.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasSource)(
    "lists exactly the commands cli/lib/commands.mjs exports, in the same order",
    async () => {
      const mod = (await import(pathToFileURL(COMMANDS_FILE).href)) as Record<
        string,
        unknown
      >;
      const table = Object.values(mod).find(isCommandTable);
      expect(
        table,
        "cli/lib/commands.mjs must export an array of { name, summary, usage }",
      ).toBeDefined();
      const pick = (list: readonly CliCommand[]) =>
        list.map(({ name, summary, usage }) => ({ name, summary, usage }));
      expect(pick(CLI_COMMANDS)).toEqual(pick(table as CliCommand[]));
    },
  );

  it.skipIf(!existsSync(join(CLI_DIR, "package.json")))(
    "is the npm package the site names",
    () => {
      const pkg = JSON.parse(
        readFileSync(join(CLI_DIR, "package.json"), "utf8"),
      ) as { name?: string };
      expect(pkg.name).toBe(CLI.name);
    },
  );
});
