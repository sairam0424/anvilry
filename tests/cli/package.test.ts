import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { PROCESS_TEST_TIMEOUT_MS } from "./support/process-harness";
import { childEnv, CLI_ROOT } from "./support/run-cli";

const run = promisify(execFile);

vi.setConfig({
  testTimeout: PROCESS_TEST_TIMEOUT_MS,
  hookTimeout: PROCESS_TEST_TIMEOUT_MS,
});

/** npm is killed if it has not finished by then, so a hung npm cannot outlive the test run. */
const NPM_KILL_AFTER_MS = 50_000;

interface PackedFile {
  path: string;
  size: number;
}

interface PackResult {
  name: string;
  version: string;
  files: PackedFile[];
  size: number;
  unpackedSize: number;
}

/**
 * What `npm pack --dry-run` would put in the tarball. No network, no tarball, no log file; npm's
 * cache is a throwaway directory, so the user's ~/.npm is neither needed nor touched.
 */
async function runDryRunPack(): Promise<PackResult> {
  const cache = await mkdtemp(join(tmpdir(), "anvilry-npm-cache-"));
  try {
    const { stdout } = await run(
      "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts", "--logs-max=0"],
      {
        cwd: CLI_ROOT,
        timeout: NPM_KILL_AFTER_MS,
        env: childEnv({
          HOME: process.env.HOME ?? "",
          npm_config_cache: cache,
          NO_UPDATE_NOTIFIER: "1",
          npm_config_update_notifier: "false",
          npm_config_audit: "false",
          npm_config_fund: "false",
        }),
      },
    );
    return (JSON.parse(stdout) as PackResult[])[0];
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
}

/** One npm process for the whole file: the three pack tests read the same answer. */
let packing: Promise<PackResult> | undefined;
const dryRunPack = (): Promise<PackResult> => (packing ??= runDryRunPack());

/**
 * Why npm cannot be used here, when the reason is the machine and not the package: npm is not
 * installed, or it cannot write where it needs to. Any other failure is a real failure.
 */
function npmUnavailableReason(error: unknown): string | null {
  const failure = error as { code?: unknown; stderr?: unknown };
  if (failure.code === "ENOENT") return "npm is not on PATH";
  if (/\b(EACCES|EROFS|EPERM)\b/.test(String(failure.stderr ?? ""))) {
    return "npm cannot write to its home or cache directory here";
  }
  return null;
}

/** The pack result, or the test is marked skipped with the reason (never failed) when npm is unusable. */
async function packOrSkip(skip: (note?: string) => never): Promise<PackResult> {
  try {
    return await dryRunPack();
  } catch (error) {
    const reason = npmUnavailableReason(error);
    if (reason !== null) skip(`npm pack tests skipped: ${reason}`);
    throw error;
  }
}

const readManifest = async () =>
  JSON.parse(await readFile(join(CLI_ROOT, "package.json"), "utf8")) as Record<
    string,
    unknown
  >;

const ALLOWED_FILE =
  /^(bin\/[a-z-]+\.mjs|lib\/[a-z-]+\.mjs|package\.json|README\.md|LICENSE)$/;
const FORBIDDEN_FILE =
  /(test|spec|\.env|secret|credential|token|\.key|\.pem|\.log|\.map|node_modules)/i;
/** The package is a few small files; this guards against a build artifact or a data file sneaking in. */
const MAX_UNPACKED_BYTES = 80_000;

describe("npm pack --dry-run", () => {
  it("lists only the whitelisted files", async ({ skip }) => {
    const pack = await packOrSkip(skip);
    const paths = pack.files.map((file) => file.path);
    for (const path of paths) {
      expect(path, path).toMatch(ALLOWED_FILE);
      expect(path, path).not.toMatch(FORBIDDEN_FILE);
    }
  });

  it("contains every lib module, the binary, the manifest, the README and the licence", async ({
    skip,
  }) => {
    const pack = await packOrSkip(skip);
    const libModules = (await readdir(join(CLI_ROOT, "lib")))
      .filter((name) => name.endsWith(".mjs"))
      .map((name) => `lib/${name}`);
    expect(libModules.length).toBeGreaterThan(5);
    expect(pack.files.map((file) => file.path).sort()).toEqual(
      [
        "LICENSE",
        "README.md",
        "bin/anvilry.mjs",
        "package.json",
        ...libModules,
      ].sort(),
    );
  });

  it("packs the name and version the manifest declares, and stays small", async ({
    skip,
  }) => {
    const pack = await packOrSkip(skip);
    const manifest = await readManifest();
    expect(pack.name).toBe("anvilry");
    expect(pack.version).toBe(manifest.version);
    expect(pack.unpackedSize).toBeLessThan(MAX_UNPACKED_BYTES);
  });
});

describe("deciding when the pack tests are skipped instead of failed", () => {
  it("treats a missing npm as a reason to skip", async () => {
    const error = await run("npm", ["--version"], {
      env: { PATH: "" } as unknown as NodeJS.ProcessEnv,
    }).then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(npmUnavailableReason(error)).toBe("npm is not on PATH");
  });

  it("treats an npm that cannot write its cache or logs as a reason to skip", () => {
    for (const code of ["EACCES", "EROFS", "EPERM"]) {
      expect(
        npmUnavailableReason({ stderr: `npm error code ${code}\nnpm error path /x` }),
      ).toBe("npm cannot write to its home or cache directory here");
    }
  });

  it("does not hide a real failure of the package", () => {
    expect(npmUnavailableReason({ stderr: "npm error code EJSONPARSE" })).toBeNull();
    expect(npmUnavailableReason(new Error("boom"))).toBeNull();
  });
});

describe("the manifest", () => {
  it("is ready to publish as the public, dependency-free package `anvilry`", async () => {
    const manifest = await readManifest();
    expect(manifest).toMatchObject({
      name: "anvilry",
      version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      type: "module",
      files: ["bin", "lib", "README.md", "LICENSE"],
      license: "MIT",
      repository: {
        type: "git",
        url: "git+https://github.com/sairam0424/anvilry.git",
        directory: "cli",
      },
      homepage: "https://anvilry.vercel.app/developers",
      bugs: { url: "https://github.com/sairam0424/anvilry/issues" },
    });
    expect(manifest.private).toBeUndefined();
    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.devDependencies).toBeUndefined();
    expect(manifest.scripts).toBeUndefined();
    expect(manifest.keywords).toEqual(
      expect.arrayContaining(["anvilry", "cli"]),
    );
  });

  it("names the binary without a leading ./, which npm would otherwise strip with a warning", async () => {
    const manifest = await readManifest();
    expect(manifest.bin).toEqual({ anvilry: "bin/anvilry.mjs" });
  });

  it("requires Node.js 18.3, the first release that has util.parseArgs", async () => {
    const manifest = await readManifest();
    expect(manifest.engines).toEqual({ node: ">=18.3.0" });
  });

  it("publishes publicly and does not force provenance, which only a supported CI can produce", async () => {
    const manifest = await readManifest();
    expect(manifest.publishConfig).toEqual({ access: "public" });
  });

  it("ships the MIT text with the repository's copyright line", async () => {
    const [cliLicense, repoLicense] = await Promise.all([
      readFile(join(CLI_ROOT, "LICENSE"), "utf8"),
      readFile(join(CLI_ROOT, "..", "LICENSE"), "utf8"),
    ]);
    const mitText = repoLicense.split("\n---\n")[0].trimEnd();
    expect(cliLicense.trimEnd()).toBe(mitText);
  });
});

describe("the sources keep the CLI's promises", () => {
  /** Block comments and whole-line comments are dropped, so JSDoc types like import("./x.mjs") are not read as code. */
  const withoutComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  async function sources(): Promise<{ file: string; text: string }[]> {
    const files = [
      "bin/anvilry.mjs",
      ...(await readdir(join(CLI_ROOT, "lib"))).map((name) => `lib/${name}`),
    ];
    return Promise.all(
      files.map(async (file) => ({
        file,
        text: withoutComments(await readFile(join(CLI_ROOT, file), "utf8")),
      })),
    );
  }

  it("imports nothing but Node built-ins and its own modules (zero dependencies)", async () => {
    for (const { file, text } of await sources()) {
      for (const [, specifier] of text.matchAll(/\bfrom\s+"([^"]+)"/g)) {
        expect(
          specifier.startsWith("node:") ||
            specifier.startsWith("./") ||
            specifier.startsWith("../"),
          `${file} imports ${specifier}`,
        ).toBe(true);
      }
      expect(text, file).not.toMatch(/\brequire\(/);
      expect(text, file).not.toMatch(/\bimport\(/);
    }
  });

  it("has no way to open a socket except fetch, and none to run a program", async () => {
    const forbidden =
      /node:(http|https|http2|net|tls|dgram|dns|child_process|worker_threads|cluster)\b/;
    for (const { file, text } of await sources()) {
      expect(text, file).not.toMatch(forbidden);
    }
  });

  it("reads and writes no file except its own package.json", async () => {
    const fileSystemUse =
      /\b(writeFile|appendFile|createWriteStream|mkdir|rename|unlink|rm|copyFile|open|readdir|opendir)(Sync)?\b\s*\(/;
    for (const { file, text } of await sources()) {
      expect(text, file).not.toMatch(fileSystemUse);
      if (file !== "lib/version.mjs") expect(text, file).not.toMatch(/node:fs/);
    }
    const version = await readFile(join(CLI_ROOT, "lib/version.mjs"), "utf8");
    expect([...version.matchAll(/readFileSync\(/g)]).toHaveLength(1);
    expect(version).toContain('new URL("../package.json", import.meta.url)');
  });

  it("reads the environment in one place, and only ANVILRY_BASE_URL", async () => {
    const reads: string[] = [];
    for (const { file, text } of await sources()) {
      for (const [, access] of text.matchAll(
        /process\.env(\.\w+|\[[^\]]*\]|\b(?!\.|\[))/g,
      )) {
        reads.push(`${file}: process.env${access}`);
      }
    }
    expect(reads).toEqual(["bin/anvilry.mjs: process.env.ANVILRY_BASE_URL"]);
  });

  it("names no host other than the Anvilry site, so there is nowhere to send telemetry", async () => {
    for (const { file, text } of await sources()) {
      const hosts = [
        ...text.matchAll(/https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)/gi),
      ].map((match) => match[1]);
      for (const host of hosts) {
        expect(host, `${file} mentions ${host}`).toBe("anvilry.vercel.app");
      }
    }
  });

  it("marks the binary executable with a node shebang", async () => {
    const bin = await readFile(join(CLI_ROOT, "bin/anvilry.mjs"), "utf8");
    expect(bin.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });
});
