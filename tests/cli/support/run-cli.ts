import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

export const CLI_ROOT = fileURLToPath(new URL("../../../cli", import.meta.url));
export const CLI_ENTRY = `${CLI_ROOT}/bin/anvilry.mjs`;

/**
 * A child that has not exited after this long is killed and the test fails with a clear message.
 * It is a watchdog against a hung binary, far above anything a loaded machine needs, and sits
 * below the per-test timeout so the child never outlives its test.
 */
export const CHILD_WATCHDOG_MS = 40_000;

export interface CliResult {
  code: number | null;
  /** Standard output decoded as UTF-8. */
  stdout: string;
  /** Standard output exactly as the process wrote it. */
  stdoutBytes: Buffer;
  stderr: string;
}

/**
 * A child process environment built from scratch: PATH plus what the test names, nothing the
 * test runner happens to have set. (The cast is only for Next's ProcessEnv, which insists on NODE_ENV.)
 */
export function childEnv(
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    ...extra,
  } as unknown as NodeJS.ProcessEnv;
}

interface CliOptions {
  /** Added to a minimal environment; the CLI never inherits the test runner's variables. */
  env?: Record<string, string>;
  cwd?: string;
}

/** Every child that has been started and has not yet exited. */
const running = new Set<ChildProcess>();

/**
 * Kills any CLI process that is still alive and returns how many there were. A well-behaved test
 * leaves none: the harness calls this after each test and fails the test when the count is not 0.
 */
export function killStrayChildren(): number {
  const strays = [...running];
  running.clear();
  strays.forEach((child) => child.kill("SIGKILL"));
  return strays.length;
}

export interface RunningCli {
  /** The process, for a test that has to touch its pipes (close one early, for instance). */
  child: ChildProcess;
  /** Settles when the process has exited and both pipes are closed. */
  done: Promise<CliResult>;
}

/**
 * Starts the real binary (node cli/bin/anvilry.mjs) as a child process. It is asynchronous on
 * purpose: the mock API lives in this same process and must keep serving while the child waits.
 */
export function startCli(
  args: string[],
  { env = {}, cwd }: CliOptions = {},
): RunningCli {
  const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
    cwd,
    env: childEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  running.add(child);
  const done = new Promise<CliResult>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    let stderr = "";
    const watchdog = setTimeout(() => {
      child.kill("SIGKILL");
      reject(
        new Error(
          `anvilry ${args.join(" ")} did not exit within ${CHILD_WATCHDOG_MS} ms`,
        ),
      );
    }, CHILD_WATCHDOG_MS);
    child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => {
      clearTimeout(watchdog);
      running.delete(child);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(watchdog);
      running.delete(child);
      const stdoutBytes = Buffer.concat(stdoutChunks);
      resolve({
        code,
        stdout: stdoutBytes.toString("utf8"),
        stdoutBytes,
        stderr,
      });
    });
  });
  return { child, done };
}

export const runCli = (
  args: string[],
  options: CliOptions = {},
): Promise<CliResult> => startCli(args, options).done;
