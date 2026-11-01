/**
 * The README of the CLI package is read on GitHub and on npm, and it must not tell anyone that
 * `npx anvilry` works before the package is on the registry. While `CLI.published` is false the
 * README carries a status block under its title and words its install section "Once published:";
 * when the flag is flipped both must be deleted, and this check is what forces that.
 */
export const NOT_PUBLISHED_MARKER = "Not published to npm yet";
export const ONCE_PUBLISHED_MARKER = "Once published:";
export const RUN_FROM_CLONE = "node cli/bin/anvilry.mjs <command>";

/**
 * What is wrong with the README for the given publication state; an empty list means it is right.
 * A pure function of its two arguments, so both branches are tested without touching the real flag.
 */
export function readmeStatusProblems(
  readme: string,
  published: boolean,
): string[] {
  if (published) {
    return [NOT_PUBLISHED_MARKER, ONCE_PUBLISHED_MARKER, RUN_FROM_CLONE]
      .filter((text) => readme.includes(text))
      .map(
        (text) =>
          `the package is published, so the README must no longer say "${text}"`,
      );
  }
  const problems = [NOT_PUBLISHED_MARKER, RUN_FROM_CLONE, ONCE_PUBLISHED_MARKER]
    .filter((text) => !readme.includes(text))
    .map(
      (text) =>
        `the package is not published, so the README must say "${text}"`,
    );
  const firstSection = readme.search(/^## /m);
  const marker = readme.indexOf(NOT_PUBLISHED_MARKER);
  if (marker !== -1 && (firstSection === -1 || marker > firstSection)) {
    problems.push("the status block must come before the first section");
  }
  return problems;
}
