/**
 * The README of the CLI package is read on GitHub and on npm, and it must not tell anyone that
 * `npx anvilry` works before the package is on the registry. While `CLI.published` is false the
 * README carries a status block, between two marker lines, directly under its title, and words
 * its install section "Once published:". When the flag is flipped the maintainer deletes the
 * block (both marker lines and everything between them) and that lead-in line, and this check
 * is what forces it.
 *
 * Only whole lines count, and the lead-in only inside the Install section, so the release steps
 * in the Maintainers section can describe the edit without tripping the check.
 */
export const BLOCK_START = "<!-- status:unpublished:start -->";
export const BLOCK_END = "<!-- status:unpublished:end -->";
export const NOT_PUBLISHED_TEXT = "Not published to npm yet";
export const RUN_FROM_CLONE = "node cli/bin/anvilry.mjs <command>";
export const INSTALL_LEAD_IN = "Once published:";

const INSTALL_HEADING = "## Install";

/** The lines of the section under "## Install", up to the next "## " heading. */
function installSection(lines: string[]): string[] {
  const start = lines.indexOf(INSTALL_HEADING);
  if (start === -1) return [];
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  return lines.slice(start + 1, next === -1 ? undefined : next);
}

/**
 * What is wrong with the README for the given publication state; an empty list means it is right.
 * A pure function of its two arguments, so both branches are tested without touching the real flag.
 */
export function readmeStatusProblems(
  readme: string,
  published: boolean,
): string[] {
  const lines = readme.split("\n").map((line) => line.trim());
  const start = lines.indexOf(BLOCK_START);
  const end = lines.indexOf(BLOCK_END);
  const leadIn = installSection(lines).includes(INSTALL_LEAD_IN);

  if (published) {
    return [
      ...(start === -1 && end === -1
        ? []
        : [
            `the package is published, so the README must no longer have the status block (the lines "${BLOCK_START}" and "${BLOCK_END}" and what is between them)`,
          ]),
      ...(leadIn
        ? [
            `the package is published, so the Install section must no longer say "${INSTALL_LEAD_IN}"`,
          ]
        : []),
    ];
  }

  const problems: string[] = [];
  if (start === -1)
    problems.push(`the README must have the line "${BLOCK_START}"`);
  if (end === -1) problems.push(`the README must have the line "${BLOCK_END}"`);
  if (start !== -1 && end !== -1) {
    if (end < start) problems.push("the status block must end after it starts");
    const block = lines.slice(start, end).join("\n");
    for (const text of [NOT_PUBLISHED_TEXT, RUN_FROM_CLONE]) {
      if (!block.includes(text)) {
        problems.push(`the status block must say "${text}"`);
      }
    }
    const firstSection = lines.findIndex((line) => line.startsWith("## "));
    if (firstSection !== -1 && start > firstSection) {
      problems.push("the status block must come before the first section");
    }
  }
  if (!leadIn) {
    problems.push(
      `the Install section must have the line "${INSTALL_LEAD_IN}"`,
    );
  }
  return problems;
}

/**
 * The README edit the release steps describe, applied to a README text: delete the status block
 * (both marker lines and everything between them) and the Install lead-in line. The tests
 * run it on the real README to prove that doing what the steps say leaves the check satisfied.
 */
export function followReleaseSteps(readme: string): string {
  const lines = readme.split("\n");
  const start = lines.findIndex((line) => line.trim() === BLOCK_START);
  const end = lines.findIndex((line) => line.trim() === BLOCK_END);
  const withoutBlock =
    start === -1 || end === -1
      ? lines
      : [...lines.slice(0, start), ...lines.slice(end + 1)];
  const heading = withoutBlock.findIndex(
    (line) => line.trim() === INSTALL_HEADING,
  );
  return withoutBlock
    .filter(
      (line, index) =>
        !(index > heading && heading !== -1 && line.trim() === INSTALL_LEAD_IN),
    )
    .join("\n");
}
