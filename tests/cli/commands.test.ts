import { describe, expect, it } from "vitest";
import { COMMAND_FLAGS, COMMANDS, FLAGS } from "../../cli/lib/commands.mjs";

/**
 * The command table is the contract the site pins its documentation to, so these tests pin its
 * shape: adding a key, renaming one or changing a command fails here and has to be deliberate.
 */

const COMMAND_NAMES = [
  "profile",
  "work",
  "projects",
  "articles",
  "notes",
  "decisions",
  "search",
  "resume",
  "stats",
  "openapi",
  "batch",
  "status",
  "help",
  "version",
];

const COMMAND_KEYS = ["input", "method", "name", "path", "summary", "usage"];
const INPUT_KEYS = ["name", "repeatable", "required", "source"];
const FLAG_KEYS = ["env", "name", "summary", "type", "value"];

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return (
    Object.isFrozen(value) &&
    Object.values(value).every((child) => isDeeplyFrozen(child))
  );
}

describe("the command table", () => {
  it("lists exactly the documented commands, in order", () => {
    expect(COMMANDS.map((command) => command.name)).toEqual(COMMAND_NAMES);
  });

  it("gives every command the documented keys and nothing else", () => {
    for (const command of COMMANDS) {
      expect(Object.keys(command).sort()).toEqual(COMMAND_KEYS);
    }
  });

  it("anchors each usage on its own name and ends each summary with a full stop", () => {
    for (const command of COMMANDS) {
      expect(command.usage.startsWith(`anvilry ${command.name}`)).toBe(true);
      expect(command.summary.endsWith(".")).toBe(true);
    }
  });

  it("makes a request for every command except help and version", () => {
    const local = COMMANDS.filter((command) => command.method === null);
    expect(local.map((command) => command.name)).toEqual(["help", "version"]);
    for (const command of local) expect(command.path).toBeNull();
    for (const command of COMMANDS.filter((entry) => entry.method !== null)) {
      expect(["GET", "POST"]).toContain(command.method);
      expect(command.path).toMatch(/^\/[A-Za-z0-9/._{}?-]+$/);
    }
  });

  it("sends only batch as POST", () => {
    const posts = COMMANDS.filter((command) => command.method === "POST");
    expect(posts.map((command) => command.name)).toEqual(["batch"]);
  });

  it("declares every template variable of a path as the command's input", () => {
    for (const command of COMMANDS) {
      const variables = [
        ...(command.path ?? "").matchAll(/\{[/?]([a-z]+)\}/g),
      ].map((match) => match[1]);
      // A repeatable input (batch paths) goes into the request body, not into the path.
      const fillsPath = command.input !== null && !command.input.repeatable;
      expect(variables).toEqual(fillsPath ? [command.input?.name] : []);
    }
  });

  it("describes each input with the documented keys", () => {
    for (const command of COMMANDS) {
      if (command.input === null) continue;
      expect(Object.keys(command.input).sort()).toEqual(INPUT_KEYS);
    }
  });

  it("pins the input of the commands that take one", () => {
    const inputs = Object.fromEntries(
      COMMANDS.filter((command) => command.input).map((command) => [
        command.name,
        command.input,
      ]),
    );
    expect(inputs).toEqual({
      work: {
        name: "slug",
        source: "argument",
        required: false,
        repeatable: false,
      },
      projects: {
        name: "slug",
        source: "argument",
        required: false,
        repeatable: false,
      },
      articles: {
        name: "slug",
        source: "argument",
        required: false,
        repeatable: false,
      },
      notes: {
        name: "slug",
        source: "argument",
        required: false,
        repeatable: false,
      },
      decisions: {
        name: "tag",
        source: "flag",
        required: false,
        repeatable: false,
      },
      search: {
        name: "q",
        source: "argument",
        required: true,
        repeatable: false,
      },
      batch: {
        name: "paths",
        source: "argument",
        required: true,
        repeatable: true,
      },
    });
  });

  it("pins the path template of every command", () => {
    expect(
      Object.fromEntries(
        COMMANDS.map((command) => [command.name, command.path]),
      ),
    ).toEqual({
      profile: "/api/v1/profile",
      work: "/api/v1/work{/slug}",
      projects: "/api/v1/projects{/slug}",
      articles: "/api/v1/articles{/slug}",
      notes: "/api/v1/notes{/slug}",
      decisions: "/api/v1/decisions{?tag}",
      search: "/api/v1/search{?q}",
      resume: "/api/v1/resume",
      stats: "/api/v1/github/stats",
      openapi: "/openapi.json",
      batch: "/api/v1/batch",
      status: "/api/v1",
      help: null,
      version: null,
    });
  });

  it("cannot be changed at run time", () => {
    expect(isDeeplyFrozen(COMMANDS)).toBe(true);
    expect(isDeeplyFrozen(FLAGS)).toBe(true);
    expect(isDeeplyFrozen(COMMAND_FLAGS)).toBe(true);
  });
});

describe("the flag table", () => {
  it("lists the documented flags with the documented keys", () => {
    expect(FLAGS.map((flag) => flag.name)).toEqual([
      "base-url",
      "raw",
      "headers",
      "timeout",
      "help",
      "version",
    ]);
    for (const flag of FLAGS) {
      expect(Object.keys(flag).sort()).toEqual(FLAG_KEYS);
    }
  });

  it("reads the base URL default from ANVILRY_BASE_URL and nothing else", () => {
    const withEnv = FLAGS.filter((flag) => flag.env !== null);
    expect(withEnv.map((flag) => [flag.name, flag.env])).toEqual([
      ["base-url", "ANVILRY_BASE_URL"],
    ]);
  });

  it("derives the per-command flags from the command table", () => {
    expect(COMMAND_FLAGS).toEqual([
      { name: "tag", type: "string", command: "decisions" },
    ]);
  });
});
