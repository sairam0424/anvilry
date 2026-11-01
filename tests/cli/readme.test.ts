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
  MAX_TIMEOUT_MS,
} from "../../cli/lib/constants.mjs";
import {
  NOT_PUBLISHED_MARKER,
  ONCE_PUBLISHED_MARKER,
  RUN_FROM_CLONE,
  readmeStatusProblems,
} from "./support/readme-status";
import { CLI_ROOT } from "./support/run-cli";

const readReadme = () => readFile(join(CLI_ROOT, "README.md"), "utf8");

const UNPUBLISHED_README = [
  "# anvilry",
  "",
  `> **${NOT_PUBLISHED_MARKER}.** Run it with \`${RUN_FROM_CLONE}\`.`,
  "",
  "## Install",
  "",
  `${ONCE_PUBLISHED_MARKER} npx anvilry`,
].join("\n");

const PUBLISHED_README = [
  "# anvilry",
  "",
  "## Install",
  "",
  "npx anvilry",
].join("\n");

describe("the README status check", () => {
  it("accepts the status block while the package is unpublished", () => {
    expect(readmeStatusProblems(UNPUBLISHED_README, false)).toEqual([]);
  });

  it("accepts a README without the block once the package is published", () => {
    expect(readmeStatusProblems(PUBLISHED_README, true)).toEqual([]);
  });

  it("flags a README that forgot the block while unpublished", () => {
    const problems = readmeStatusProblems(PUBLISHED_README, false);
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toContain(NOT_PUBLISHED_MARKER);
    expect(problems.join("\n")).toContain(RUN_FROM_CLONE);
    expect(problems.join("\n")).toContain(ONCE_PUBLISHED_MARKER);
  });

  it("flags a README that still carries the block after publishing", () => {
    const problems = readmeStatusProblems(UNPUBLISHED_README, true);
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toContain("must no longer say");
  });

  it("wants the block under the title, before any section", () => {
    const buried = [
      "# anvilry",
      "",
      "## Install",
      "",
      `${ONCE_PUBLISHED_MARKER} npx anvilry`,
      "",
      `> ${NOT_PUBLISHED_MARKER}. Run \`${RUN_FROM_CLONE}\`.`,
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
