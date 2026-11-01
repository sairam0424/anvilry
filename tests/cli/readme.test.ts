import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMIT_POLICY } from "@/lib/api-policy";
import { CLI } from "@/lib/developer-tools";
import { COMMANDS, FLAGS } from "../../cli/lib/commands.mjs";
import {
  BATCH_MAX_OPERATIONS,
  DEFAULT_TIMEOUT_MS,
  MAX_BODY_BYTES,
  MAX_PRETTY_CHARS,
  MAX_PRETTY_NESTING,
  MAX_TIMEOUT_MS,
} from "../../cli/lib/constants.mjs";
import {
  BLOCK_END,
  BLOCK_START,
  INSTALL_LEAD_IN,
  NOT_PUBLISHED_TEXT,
  RUN_FROM_CLONE,
  followReleaseSteps,
  readmeStatusProblems,
} from "./support/readme-status";
import { CLI_ROOT } from "./support/run-cli";

const readReadme = () => readFile(join(CLI_ROOT, "README.md"), "utf8");

/** A small README shaped like the real one: block under the title, lead-in in Install, steps at the end. */
const UNPUBLISHED_README = [
  "# anvilry",
  "",
  BLOCK_START,
  `> **${NOT_PUBLISHED_TEXT}.** Run it with \`${RUN_FROM_CLONE}\`.`,
  BLOCK_END,
  "",
  "A command line client.",
  "",
  "## Install",
  "",
  INSTALL_LEAD_IN,
  "",
  "```sh",
  "npx anvilry profile",
  "```",
  "",
  "## Maintainers: releasing",
  "",
  `5. Delete the status block and the lead-in. (This step mentions "${INSTALL_LEAD_IN}" and ${BLOCK_START} inside a sentence.)`,
].join("\n");

describe("the README status check", () => {
  it("accepts the block and the lead-in while the package is unpublished", () => {
    expect(readmeStatusProblems(UNPUBLISHED_README, false)).toEqual([]);
  });

  it("accepts a README without either once the package is published", () => {
    expect(
      readmeStatusProblems(followReleaseSteps(UNPUBLISHED_README), true),
    ).toEqual([]);
  });

  it("is satisfied again after the release steps, and fails if any one is left undone", () => {
    const afterSteps = followReleaseSteps(UNPUBLISHED_README);
    expect(afterSteps.split("\n").map((line) => line.trim())).not.toContain(BLOCK_START);
    expect(afterSteps).not.toContain(NOT_PUBLISHED_TEXT);
    expect(readmeStatusProblems(afterSteps, true)).toEqual([]);

    // The block left in place after publishing.
    expect(readmeStatusProblems(UNPUBLISHED_README, true)).toHaveLength(2);
    // Only the block deleted: the Install lead-in is still there.
    const blockOnly = UNPUBLISHED_README.split("\n")
      .filter((line) => !line.startsWith("<!--") && !line.startsWith("> **"))
      .join("\n");
    expect(readmeStatusProblems(blockOnly, true)).toEqual([
      `the package is published, so the Install section must no longer say "${INSTALL_LEAD_IN}"`,
    ]);
    // Only the lead-in deleted: the block is still there.
    const leadInOnly = UNPUBLISHED_README.split("\n")
      .filter((line) => line !== INSTALL_LEAD_IN)
      .join("\n");
    expect(readmeStatusProblems(leadInOnly, true)).toHaveLength(1);
  });

  it("fails an unpublished README when the lead-in is missing, so that half of the check can fail", () => {
    const noLeadIn = UNPUBLISHED_README.split("\n")
      .filter((line) => line !== INSTALL_LEAD_IN)
      .join("\n");
    expect(readmeStatusProblems(noLeadIn, false)).toEqual([
      `the Install section must have the line "${INSTALL_LEAD_IN}"`,
    ]);
  });

  it("only counts the lead-in inside the Install section", () => {
    const elsewhere = UNPUBLISHED_README.split("\n")
      .filter((line) => line !== INSTALL_LEAD_IN)
      .concat([INSTALL_LEAD_IN])
      .join("\n");
    expect(readmeStatusProblems(elsewhere, false)).toEqual([
      `the Install section must have the line "${INSTALL_LEAD_IN}"`,
    ]);
  });

  it("flags a missing, reversed or empty block while unpublished", () => {
    const noBlock = UNPUBLISHED_README.split("\n")
      .filter((line) => line !== BLOCK_START && line !== BLOCK_END)
      .join("\n");
    expect(readmeStatusProblems(noBlock, false)).toEqual([
      `the README must have the line "${BLOCK_START}"`,
      `the README must have the line "${BLOCK_END}"`,
    ]);

    const reversed = UNPUBLISHED_README.replace(BLOCK_START, "@@")
      .replace(BLOCK_END, BLOCK_START)
      .replace("@@", BLOCK_END);
    expect(readmeStatusProblems(reversed, false)).toContain(
      "the status block must end after it starts",
    );

    const emptyBlock = UNPUBLISHED_README.replace(/^> \*\*.*$/m, "");
    expect(readmeStatusProblems(emptyBlock, false)).toEqual([
      `the status block must say "${NOT_PUBLISHED_TEXT}"`,
      `the status block must say "${RUN_FROM_CLONE}"`,
    ]);
  });

  it("wants the block before the first section", () => {
    const buried = [
      "# anvilry",
      "",
      "## Install",
      "",
      INSTALL_LEAD_IN,
      "",
      BLOCK_START,
      `> ${NOT_PUBLISHED_TEXT}. Run \`${RUN_FROM_CLONE}\`.`,
      BLOCK_END,
    ].join("\n");
    expect(readmeStatusProblems(buried, false)).toEqual([
      "the status block must come before the first section",
    ]);
  });
});

describe("the README of the package", () => {
  it("matches the publication state the site is built from (CLI.published)", async () => {
    expect(readmeStatusProblems(await readReadme(), CLI.published)).toEqual([]);
  });

  // The two rehearsals below describe the README as it is BEFORE the first release. After the
  // maintainer has followed step 5 they have nothing left to rehearse, so they stand down with the flag.
  it.skipIf(CLI.published)("is satisfied by the release steps it describes: following them leaves the check green for a published package", async () => {
    // This is the rehearsal of the flip. It runs the edit the steps ask for on the real README
    // and expects the check, with the flag true, to pass; step 5 itself must not get in the way.
    const readme = await readReadme();
    const afterSteps = followReleaseSteps(readme);
    expect(afterSteps).not.toBe(readme);
    expect(readmeStatusProblems(afterSteps, true)).toEqual([]);
  });

  it.skipIf(CLI.published)("fails for a published package until the release steps have been followed", async () => {
    expect(readmeStatusProblems(await readReadme(), true)).not.toEqual([]);
  });

  it("lists every command by its usage line and every flag", async () => {
    const readme = await readReadme();
    for (const command of COMMANDS) {
      expect(readme, command.usage).toContain(command.usage);
    }
    for (const flag of FLAGS) {
      expect(readme, flag.name).toContain(`--${flag.name}`);
    }
    expect(readme).toContain("--tag <tag>");
  });

  it("quotes the limits the code enforces", async () => {
    const readme = await readReadme();
    expect(readme).toContain(`up to ${BATCH_MAX_OPERATIONS} API paths`);
    expect(readme).toContain(
      `1 to ${MAX_TIMEOUT_MS}, default ${DEFAULT_TIMEOUT_MS}`,
    );
    expect(readme).toContain(`${MAX_BODY_BYTES / (1024 * 1024)} MiB`);
    expect(readme).toContain(`${MAX_PRETTY_NESTING} levels`);
    expect(readme).toContain(
      `${MAX_PRETTY_CHARS / (1024 * 1024)} MiB when indented`,
    );
    expect(readme).toContain(
      `${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds`,
    );
  });

  it("states the Node.js version the manifest requires", async () => {
    const manifest = JSON.parse(
      await readFile(join(CLI_ROOT, "package.json"), "utf8"),
    ) as { engines: { node: string } };
    expect(manifest.engines.node).toBe(">=18.3.0");
    expect(await readReadme()).toContain("Node.js 18.3 or newer");
  });

  it("does not follow redirects, and says so", async () => {
    const readme = await readReadme();
    expect(readme).toContain("does not follow redirects");
    expect(readme).not.toContain("redirects from that host are followed");
  });
});
